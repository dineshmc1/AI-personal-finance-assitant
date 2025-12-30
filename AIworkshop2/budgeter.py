# AI workshop 2/budgeter.py
import os
from typing import Dict, List, Any, Optional
from datetime import date, timedelta, datetime
from firebase_admin import firestore
from openai import OpenAI
import logging
from collections import defaultdict
from dotenv import load_dotenv


load_dotenv()
OPENAI_CLIENT = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL_NAME = "gpt-4o-mini" 

logging.basicConfig(level=logging.INFO)


def analyze_recent_transactions(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyzes transactions to calculate average monthly income and spending by category.
    Uses YYYY-MM bucketization for accurate averaging across months.
    """
    if not transactions:
        return {"avg_monthly_income": 0.0, "avg_monthly_spending": {}}
        
    monthly_buckets = defaultdict(lambda: {"income": 0.0, "spending": defaultdict(float)})
    
    for tx in transactions:
        try:
            raw_date = tx.get('transaction_date')
            if isinstance(raw_date, str):
                tx_date = date.fromisoformat(raw_date.split('T')[0])
            elif isinstance(raw_date, (date, datetime)):
                tx_date = raw_date
            else:
                continue

            month_key = tx_date.strftime("%Y-%m")
            amount = float(tx.get('amount', 0.0))
            tx_type = tx.get('type')
            
            if tx_type == 'Expense':
                category = tx.get('category', 'Uncategorized')
                monthly_buckets[month_key]["spending"][category] += amount
            elif tx_type == 'Income':
                monthly_buckets[month_key]["income"] += amount
        except (ValueError, KeyError, TypeError):
            continue

    if not monthly_buckets:
        return {
            "avg_monthly_income": 0.0,
            "avg_monthly_spending": {}
        }
        
    num_months = len(monthly_buckets)
    total_income = sum(data["income"] for data in monthly_buckets.values())
    
    category_totals = defaultdict(float)
    for data in monthly_buckets.values():
        for cat, amt in data["spending"].items():
            category_totals[cat] += amt
            
    avg_monthly_income = float(round(total_income / num_months, 2))
    avg_monthly_spending = {
        cat: float(round(amt / num_months, 2))
        for cat, amt in category_totals.items()
    }
    
    return {
        "avg_monthly_income": avg_monthly_income,
        "avg_monthly_spending": avg_monthly_spending,
        "num_months_analyzed": num_months
    }

def generate_budget_prompt(analysis: Dict[str, Any], fhs_report: Dict[str, Any], lstm_report: Dict[str, Any], currency: str = "USD") -> str:
    """
    Constructs a detailed prompt for the GPT model, respecting the user's currency.
    """
    
    fhs_summary = fhs_report.get('summary', {})
    lstm_summary = lstm_report.get('summary', {})
    
    income = analysis.get('avg_monthly_income', 0.0)
    accurate_spending = analysis.get('accurate_total_spending', 0.0)
    symbol = "RM" if currency == "MYR" else currency
    
    prompt = f"You are an expert financial assistant creating a smart, 'one-tap' budget for a user.\n"
    prompt += f"The user wants a monthly budget allocation based on their accurate 3rd-month average activity.\n\n"
    
    prompt += "--- Financial Data (Accurate 3-Month Averages) ---\n"
    prompt += f"Average Monthly Income: {symbol} {income:.2f}\n"
    prompt += f"Average Total Monthly Spending: {symbol} {accurate_spending:.2f}\n"
    prompt += f"Spending Breakdown by Category: {analysis.get('avg_monthly_spending', {})}\n"
    
    prompt += "\n--- Financial Health and Forecast Context ---\n"
    prompt += f"Financial Health Score (FHS): {fhs_summary.get('latest_fhs', 'N/A')}\n"
    prompt += f"FHS Risk Profile: {fhs_summary.get('risk_profile', 'Moderate')}\n"
    prompt += f"Forecasted Monthly Net Flow (LSTM): {symbol} {lstm_summary.get('net_flow_forecast', 0.0):.2f}\n"
    prompt += f"Recommendation: {fhs_summary.get('recommendation', 'Maintain current habits.')}\n"
    
    prompt += "\n--- Task ---\n"
    prompt += f"Generate a new, optimized **monthly budget allocation** (in {symbol} and percentage) for the following standard categories. The total allocation MUST equal the Average Monthly Income ({symbol} {income:.2f})."
    prompt += "\n\nStandard Categories to allocate:"
    prompt += "\n1. Bills (must cover average 'Bills' and 'Rent' spending)"
    prompt += "\n2. Food (must cover average 'Groceries' and 'Dining Out' spending)"
    prompt += "\n3. Transport (must cover average 'Transport' and 'Fuel' spending)"
    prompt += "\n4. Discretionary/Other Expenses (covering everything else and a buffer)"
    prompt += "\n5. Savings (A separate, mandatory allocation for an Emergency Fund or Short-term goal)"
    prompt += "\n6. Investment (A separate, mandatory allocation for long-term growth, prioritizing this if the FHS risk is Low and Net Flow is positive.)"
    
    prompt += f"\n\nIMPORTANT: Use {symbol} for all currency values. DO NOT convert to any other currency."
    prompt += "\n\nProvide the output in a JSON object with two top-level keys: 'budget_allocation' (a list of objects) and 'explanation' (a string). Ensure the allocation is detailed and the total matches the monthly income."
    prompt += "\n\nJSON Output Format (Strictly adhere to this):\n"
    prompt += "{\n"
    prompt += '  "explanation": "Brief, encouraging summary of the budget logic (1-2 sentences).",\n'
    prompt += '  "budget_allocation": [\n'
    prompt += '    {"category": "Bills", "amount": 0.00, "percentage": 0.0},\n'
    prompt += '    {"category": "Food", "amount": 0.00, "percentage": 0.0},\n'
    prompt += '    {"category": "Transport", "amount": 0.00, "percentage": 0.0},\n'
    prompt += '    {"category": "Discretionary/Other Expenses", "amount": 0.00, "percentage": 0.0},\n'
    prompt += '    {"category": "Savings", "amount": 0.00, "percentage": 0.0},\n'
    prompt += '    {"category": "Investment", "amount": 0.00, "percentage": 0.0}\n'
    prompt += '  ]\n'
    prompt += '}'
    
    return prompt

async def generate_auto_budget(
    user_id: str,
    db: firestore.client,
    fhs_report: Dict[str, Any],
    lstm_report: Dict[str, Any],
    currency: str = "USD"
) -> Dict[str, Any]:
    """
    Main function to generate the budget using historical data and the GPT model.
    """
    
    try:
        from balance_manager import get_average_metrics_last_3_months
        
        # 1. Get accurate 3-month average from aggregated collection
        metrics = await get_average_metrics_last_3_months(user_id, db)
        avg_income = metrics.get("avg_monthly_income", 0.0)
        avg_spending = metrics.get("avg_monthly_spending", 0.0)
        
        # 2. Get transaction history for category breakdown
        transactions_ref = db.collection('transactions')\
            .where("user_id", "==", user_id)\
            .order_by("transaction_date", direction=firestore.Query.DESCENDING)\
            .limit(500)
        docs = transactions_ref.stream()
        
        transactions = []
        for doc in docs:
            transaction_data = doc.to_dict()
            if hasattr(transaction_data.get('transaction_date'), 'isoformat'):
                transaction_data['transaction_date'] = transaction_data['transaction_date'].isoformat()
            transactions.append(transaction_data)
            
        if not transactions:
            return {"error": "No transaction history found to generate a budget."}
            
        analysis = analyze_recent_transactions(transactions)
        
        # Override the potentially skewed averages with the accurate ones
        analysis['avg_monthly_income'] = avg_income
        # We keep the category breakdown but the AI will use the new spending total for context
        analysis['accurate_total_spending'] = avg_spending
            
        prompt = generate_budget_prompt(analysis, fhs_report, lstm_report, currency=currency)
        
        try:
            response = OPENAI_CLIENT.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": "You are a precise JSON output generator for financial planning. Only output the requested JSON object."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            model_response = response.choices[0].message.content
            import json
            budget_recommendation = json.loads(model_response)
            
            budget_recommendation["data_context"] = {
                "income": avg_income,
                "spending": avg_spending,
                "spending_breakdown": analysis['avg_monthly_spending'],
                "fhs": fhs_report.get('summary', {}).get('latest_fhs'),
                "lstm_net_flow": lstm_report.get('summary', {}).get('net_flow_forecast')
            }
            
            return budget_recommendation
            
        except Exception as e:
            logging.error(f"OpenAI API call or JSON parsing failed: {e}")
            return {"error": f"Failed to get budget from AI model: {e}"}

    except Exception as e:
        logging.error(f"General error in auto-budget generation: {e}")
        return {"error": "An internal error occurred during budget generation."}