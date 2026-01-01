# AI workshop 2/simulation.py
import os
import json
import logging
import re
from typing import Dict, Any, List, Optional
from datetime import date, datetime, timedelta
from dotenv import load_dotenv
from fastapi import HTTPException, status
import numpy as np 

from openai import AsyncOpenAI 

logging.basicConfig(level=logging.INFO)
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = os.getenv("OPENAI_API_URL")

if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY missing!")

client_kwargs = {"api_key": OPENAI_API_KEY}
if OPENAI_API_URL:
    client_kwargs["base_url"] = OPENAI_API_URL

openai_client = AsyncOpenAI(**client_kwargs)

MODEL_MINI = "gpt-4o-mini" 

EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "simulation_goal": {
            "type": "string",
            "description": "The user's financial goal (e.g., 'buy a car', 'increase savings')."
        },
        "time_horizon_months": {
            "type": "integer",
            "description": "Simulation period in months. Default 12. If years mentioned, convert (e.g., 9 yrs = 108)."
        },
        "monthly_impact": {
            "type": "number",
            "description": "Recurring monthly impact change. NEW EXPENSES (like monthly loan payments) MUST BE NEGATIVE."
        },
        "one_time_impact": {
            "type": "number",
            "description": "Immediate one-time financial impact (e.g., downpayment). Use negative for outflows. DO NOT include loan total (e.g., car price) here if it's paid monthly."
        },
        "target_amount": {
            "type": "number",
            "description": "Target savings amount if specified."
        }
    },
    "required": ["simulation_goal", "time_horizon_months"]
}

# === Custom JSON Encoder for Safety ===
class SafeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, (np.integer, int)):
            return int(obj)
        if isinstance(obj, (np.floating, float)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if hasattr(obj, 'model_dump'):
            return obj.model_dump()
        if hasattr(obj, 'dict'):
            return obj.dict()
        return super().default(obj)

def clean_json_response(content: str) -> str:
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()

def sanitize_currency(text: str, symbol: str) -> str:
    """Aggressively replaces stray $ symbols with the target currency symbol."""
    # Replace $ with symbol, but avoid double replacement if symbol already contains $
    if "$" in symbol and symbol != "$":
        # e.g. SGD/S$ - be careful. 
        # Simple approach for RM:
        return text.replace("$", symbol)
    return text.replace("$", symbol)

async def extract_simulation_parameters(user_question: str) -> Dict[str, Any]:
    if not openai_client:
        raise HTTPException(status_code=503, detail="OpenAI service not configured.")

    prompt = f"Analyze user question: '{user_question}'. Extract financial simulation parameters."

    try:
        response = await openai_client.chat.completions.create(
            model=MODEL_MINI,
            messages=[
                {
                    "role": "system", 
                    "content": (
                        "You are a precise financial parameter extractor.\n"
                        "Rules:\n"
                        "1. monthly_impact: Capture monthly payments (e.g., RM 1000/mo). MUST BE NEGATIVE for expenses.\n"
                        "2. one_time_impact: ONLY capture immediate initial costs like downpayments. IF USER MENTIONS A LOAN (e.g., 'worth 98k in loan'), SET one_time_impact TO 0. The 98k is the principal, not an immediate cash outflow from the balance.\n"
                        "3. time_horizon_months: CRITICAL. If user mentions years (e.g., '9 years'), convert to months (108). Default to 12 if not specified.\n"
                        "4. simulation_goal: Summarize clearly (e.g., 'Buy Car with Loan').\n"
                        f"JSON Schema: {json.dumps(EXTRACTION_SCHEMA)}"
                    )
                },
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0
        )
        
        content = response.choices[0].message.content
        clean_content = clean_json_response(content)
        extracted_data = json.loads(clean_content)
        
        # Validation override
        if 'time_horizon_months' not in extracted_data or extracted_data['time_horizon_months'] < 1:
            extracted_data['time_horizon_months'] = 12
        
        return extracted_data
    except Exception as e:
        logging.error(f"OpenAI extraction failed: {e}")
        return {
            "simulation_goal": "General Savings",
            "time_horizon_months": 12,
            "monthly_impact": 0,
            "one_time_impact": 0,
            "target_amount": 0
        }

def get_currency_symbol(currency: str) -> str:
    mapping = {
        "MYR": "RM",
        "USD": "$",
        "EUR": "€",
        "GBP": "£",
        "INR": "₹",
        "SGD": "S$",
        "AUD": "A$"
    }
    return mapping.get(currency.upper(), currency)

def run_financial_simulation(
    params: Dict[str, Any],
    fhs_report: Dict[str, Any],
    lstm_report: Dict[str, Any],
    initial_balance: float,
    currency: str = "MYR",
    baseline_income: Optional[float] = None,
    baseline_expense: Optional[float] = None
) -> Dict[str, Any]:
    
    # Cap horizon to 10 years for safety
    months = min(max(int(params.get('time_horizon_months', 12)), 1), 120) 
    days = months * 30  
    
    monthly_impact = float(params.get('monthly_impact', 0.0))
    one_time_impact = float(params.get('one_time_impact', 0.0))
    target_amount = float(params.get('target_amount', 0.0))
    
    forecast_results = lstm_report.get('forecast_results', [])
    summary_data = fhs_report.get('summary', {})
    initial_fhs = float(summary_data.get('latest_fhs', 50.0))
    current_fhs = initial_fhs
    
    # Authoritative Baselines (preferred over LSTM raw prediction if available)
    # This prevents the simulation from being grounded in potentially low LSTM predictions.
    avg_monthly_income = baseline_income if baseline_income is not None else 0.0
    avg_monthly_expense = baseline_expense if baseline_expense is not None else 0.0
    
    # Fallback if baselines not provided
    if avg_monthly_income <= 0:
        if len(forecast_results) > 1:
             avg_monthly_income = (sum(float(r.get('forecast_income', 0.0)) for r in forecast_results) / len(forecast_results)) * 30.0
        elif forecast_results:
             avg_monthly_income = float(forecast_results[0].get('forecast_income', 0.0)) * 30.0
        else:
             avg_monthly_income = 3000.0 # Default fallback

    if avg_monthly_expense <= 0:
         if len(forecast_results) > 1:
              avg_monthly_expense = (sum(float(r.get('forecast_expense', 0.0)) for r in forecast_results) / len(forecast_results)) * 30.0
         elif forecast_results:
              avg_monthly_expense = float(forecast_results[0].get('forecast_expense', 0.0)) * 30.0
         else:
              avg_monthly_expense = 2500.0

    dti_ratio = 0.0
    if avg_monthly_income > 0 and monthly_impact < 0:
        dti_ratio = abs(monthly_impact) / avg_monthly_income
    
    # Use baseline daily values for grounded math
    daily_base_income = avg_monthly_income / 30.0
    daily_base_expense = avg_monthly_expense / 30.0
    daily_add_impact = monthly_impact / 30.0
    
    # Apply one-time impact
    current_balance = float(initial_balance) + one_time_impact
    total_income = 0.0
    total_expense = 0.0
    
    daily_balances = [current_balance]
    fhs_scores = [current_fhs]
    
    # Structural Penalty for new Debt
    if monthly_impact < 0:
        # Debt impacts score based on DTI strain
        debt_hit = 5.0 + (dti_ratio * 25.0) 
        current_fhs = max(0.0, current_fhs - debt_hit) 
    
    for d in range(1, days + 1):
        # Grounded daily flow
        income = daily_base_income
        expense = daily_base_expense - daily_add_impact # daily_add_impact is negative for expenses
        
        if params.get('simulation_goal') == 'reduce spending':
            expense *= 0.90
            
        net_flow = income - expense
        current_balance += net_flow
        total_income += income
        total_expense += expense
        
        # Sample every 30 days for plot efficiency
        if d % 30 == 0 or d == days:
             daily_balances.append(current_balance)
        
        # FHS Growth/Pressure
        growth_multiplier = max(0.0, 1.0 - (dti_ratio * 3.0))
        flow_impact = (net_flow / 1000.0) * 0.03 * growth_multiplier
        debt_pressure = -0.05 * dti_ratio if monthly_impact < 0 else 0.0
             
        current_fhs = max(0.0, min(100.0, current_fhs + flow_impact + debt_pressure))
        
        if d % 30 == 0 or d == days:
             fhs_scores.append(current_fhs)

    final_balance = current_balance
    net_savings = final_balance - initial_balance
    
    symbol = get_currency_symbol(currency)
    goal_status = "General Simulation"
    if target_amount > 0:
        if net_savings >= target_amount:
            goal_status = f"Target {symbol} {target_amount:,.2f} reached!"
        else:
            goal_status = f"Requires {symbol} {target_amount - net_savings:,.2f} more."
            
    return {
        "initial_balance": float(initial_balance),
        "final_balance": float(final_balance),
        "total_income": float(round(total_income, 2)),
        "total_expense": float(round(total_expense, 2)),
        "net_savings": float(round(net_savings, 2)),
        "final_fhs": float(round(current_fhs, 2)),
        "fhs_change": float(round(current_fhs - initial_fhs, 2)),
        "time_horizon_months": int(months),
        "goal_status": str(goal_status),
        "simulation_goal": str(params.get('simulation_goal', 'General')),
        "currency": str(currency),
        "dti_ratio_impact": float(round(dti_ratio * 100, 2)),
        "daily_balances": [float(round(b, 2)) for b in daily_balances], 
        "daily_fhs": [float(round(f, 2)) for f in fhs_scores],
        "metrics_context": {
            "avg_income": float(round(avg_monthly_income, 2)),
            "avg_spending": float(round(avg_monthly_expense, 2))
        }
    }

async def generate_detailed_report(
    user_question: str, 
    simulation_data: Dict[str, Any], 
    initial_fhs_rating: str,
    budget_analysis: Dict[str, Any] = None,
    twin_scenarios: Dict[str, Any] = None,
    currency: str = "MYR"
) -> str:
    if not openai_client:
        return "OpenAI unavailable."

    symbol = get_currency_symbol(currency)
    budget_str = json.dumps(budget_analysis, indent=2, cls=SafeEncoder) if budget_analysis else "Not available"
    twin_str = json.dumps(twin_scenarios, indent=2, cls=SafeEncoder) if twin_scenarios else "Not available"
    
    context = simulation_data.get('metrics_context', {})
    
    prompt = (
        f"You are a professional financial advisor. Analyze these simulation results.\n"
        f"User Question: {user_question}\n\n"
        f"--- SIMULATION RESULTS (FOR {simulation_data.get('time_horizon_months')} MONTHS) ---\n"
        f"Currency: {currency} (Use symbol: {symbol})\n"
        f"Initial Balance: {symbol} {simulation_data.get('initial_balance'):,.2f}\n"
        f"Final Balance: {symbol} {simulation_data.get('final_balance'):,.2f}\n"
        f"Total Income Over {simulation_data.get('time_horizon_months')} Months: {symbol} {simulation_data.get('total_income'):,.2f}\n"
        f"Total Expense Over {simulation_data.get('time_horizon_months')} Months: {symbol} {simulation_data.get('total_expense'):,.2f}\n"
        f"NET SAVINGS Realized: {symbol} {simulation_data.get('net_savings'):,.2f}\n"
        f"Final Financial Health Score: {simulation_data.get('final_fhs')}/100\n"
        f"FHS Score Change: {simulation_data.get('fhs_change'):+.2f}\n"
        f"Baseline Info: Based on monthly income of {symbol} {context.get('avg_income'):,.2f} and spending of {symbol} {context.get('avg_spending'):,.2f}.\n\n"
        "--- INSTRUCTIONS ---\n"
        f"1. MANDATORY: Use symbol '{symbol}' for every single currency amount mentioned. **NEVER USE '$'**.\n"
        f"2. Be data-driven. Highlight how the new commitment affects their net savings over the full {simulation_data.get('time_horizon_months')} month period.\n"
        "3. Explain the long-term impact on their Financial Health Score.\n"
        "4. Keep it professional, encouraging but realistic."
    )
    
    try:
        response = await openai_client.chat.completions.create(
            model=MODEL_MINI,
            messages=[
                {"role": "system", "content": f"You are a helpful financial advisor. You use '{symbol}' for ALL amounts. NEVER use '$'. Strictly follow the provided numeric data."},
                {"role": "user", "content": prompt}
            ],
            temperature=0
        )
        report_text = response.choices[0].message.content
        verified_report = sanitize_currency(report_text, symbol)
        return verified_report
    except Exception as e:
        logging.error(f"Report gen failed: {e}")
        return f"Simulation finished. result: {json.dumps(simulation_data, cls=SafeEncoder)}"

async def generate_simulation_report(
    user_id: str,
    user_question: str,
    db: Any, 
    fhs_report_func: Any,
    lstm_report_func: Any,
    get_balance_func: Any,
    budget_analysis: Dict[str, Any],
    twin_scenarios: Dict[str, Any] = None,
    currency: str = "MYR"
) -> Dict[str, Any]:
    
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API Key missing.")

    try:
        params = await extract_simulation_parameters(user_question)
        logging.info(f"Extracted parameters: {params}")
        
        fhs_report = await fhs_report_func(user_id)
        lstm_report = await lstm_report_func(user_id)
        initial_balance = await get_balance_func(user_id, db)
        
        # Fetch Aggregated Metrics for grounded math
        baseline_income = 0.0
        baseline_spending = 0.0
        try:
             # Look for these in the provided budget_analysis which already contains them from balance_manager
             baseline_income = budget_analysis.get('avg_monthly_income', 0.0)
             baseline_spending = budget_analysis.get('accurate_total_spending', 0.0)
        except:
             pass

        simulation_data = run_financial_simulation(
            params, fhs_report, lstm_report, initial_balance, currency,
            baseline_income=baseline_income,
            baseline_expense=baseline_spending
        )

        if "error" in simulation_data:
             raise HTTPException(status_code=400, detail=simulation_data["error"])
        
        initial_fhs_rating = fhs_report.get('summary', {}).get('latest_rating', 'Unknown')
        
        final_report_markdown = await generate_detailed_report(
            user_question, 
            simulation_data,
            initial_fhs_rating,
            budget_analysis,
            twin_scenarios,
            currency
        )

        return {
            "simulation_report": final_report_markdown,
            "raw_simulation_data": simulation_data,
            "budget_analysis_snapshot": budget_analysis,
            "extracted_parameters": params
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Simulation Orchestration Failed: {e}")
        import traceback
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

async def generate_general_chat_response(user_question: str, currency: str = "USD") -> str:
    if not openai_client:
        return "OpenAI service is not configured."

    symbol = get_currency_symbol(currency)
    try:
        response = await openai_client.chat.completions.create(
            model=MODEL_MINI,
            messages=[
                {"role": "system", "content": f"You are a helpful financial advisor. Always use the specified currency ({currency}, display symbol: {symbol}) for all financial values. NEVER use '$'. Treat all values as {currency}."},
                {"role": "user", "content": user_question}
            ]
        )
        report_text = response.choices[0].message.content
        return sanitize_currency(report_text, symbol)
    except Exception as e:
        logging.error(f"Chat failed: {e}")
        return "Service unavailable."