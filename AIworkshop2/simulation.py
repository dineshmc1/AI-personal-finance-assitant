# AI workshop 2/simulation.py
import os
import json
import logging
from typing import Dict, Any, List
from datetime import date, timedelta
from dotenv import load_dotenv
from fastapi import HTTPException, status

# 1. 引入 AsyncOpenAI 以支持异步非阻塞调用
from openai import AsyncOpenAI 

logging.basicConfig(level=logging.INFO)
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = os.getenv("OPENAI_API_URL")

if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY missing!")

# 2. 初始化异步客户端
client_kwargs = {"api_key": OPENAI_API_KEY}
if OPENAI_API_URL:
    client_kwargs["base_url"] = OPENAI_API_URL

# 使用 AsyncOpenAI
openai_client = AsyncOpenAI(**client_kwargs)

MODEL_MINI = "gpt-4o-mini" 

EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "simulation_goal": {
            "type": "string",
            "description": "The user's financial goal (e.g., 'increase savings', 'reduce spending')."
        },
        "time_horizon_months": {
            "type": "integer",
            "description": "Simulation period in months. Default 12."
        },
        "target_amount": {
            "type": "number",
            "description": "Target amount if specified."
        }
    },
    "required": ["simulation_goal", "time_horizon_months"]
}

def clean_json_response(content: str) -> str:
    """Helper to remove markdown code blocks."""
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()

# 3. 改为 async def 并使用 await
async def extract_simulation_parameters(user_question: str) -> Dict[str, Any]:
    if not openai_client:
        raise HTTPException(status_code=503, detail="OpenAI service not configured.")

    prompt = f"Analyze user question: '{user_question}'. Extract financial simulation parameters."

    try:
        # 使用 await 调用异步 API
        response = await openai_client.chat.completions.create(
            model=MODEL_MINI,
            messages=[
                {
                    "role": "system", 
                    "content": f"You are a financial analyst. Output JSON ONLY matching: {json.dumps(EXTRACTION_SCHEMA)}"
                },
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0
        )
        
        content = response.choices[0].message.content
        clean_content = clean_json_response(content)
        extracted_data = json.loads(clean_content)
        
        if 'time_horizon_months' not in extracted_data:
            extracted_data['time_horizon_months'] = 12
        
        return extracted_data
    except Exception as e:
        logging.error(f"OpenAI extraction failed: {e}")
        return {
            "simulation_goal": "General Savings",
            "time_horizon_months": 12,
            "target_amount": 0
        }

def run_financial_simulation(
    params: Dict[str, Any],
    fhs_report: Dict[str, Any],
    lstm_report: Dict[str, Any],
    initial_balance: float
) -> Dict[str, Any]:
    """Pure logic function (CPU bound), no async needed here."""
    
    months = params.get('time_horizon_months', 12)
    days = months * 30  
    target_amount = params.get('target_amount', 0.0)
    
    forecast_results = lstm_report.get('forecast_results', [])
    forecast_days = len(forecast_results)
    
    if forecast_days == 0:
        return {"error": "LSTM forecast data is empty. Cannot run simulation."}
        
    summary = fhs_report.get('summary', {})
    current_fhs = summary.get('latest_fhs', 50.0)
    
    current_balance = initial_balance
    total_income = 0.0
    total_expense = 0.0
    
    daily_balances = [current_balance]
    fhs_scores = [current_fhs]
    
    for d in range(1, days + 1):
        forecast_day_data = forecast_results[(d - 1) % forecast_days]
        income = forecast_day_data.get('forecast_income', 0.0)
        expense = forecast_day_data.get('forecast_expense', 0.0)
        
        if params.get('simulation_goal') == 'reduce spending':
            expense *= 0.90
        
        net_flow = income - expense
        current_balance += net_flow
        total_income += income
        total_expense += expense
        
        daily_balances.append(current_balance)
        
        fhs_impact = (net_flow / 1000) * 0.1 
        current_fhs = max(0, min(100, current_fhs + fhs_impact))
        fhs_scores.append(current_fhs)

    final_balance = daily_balances[-1]
    net_savings = final_balance - initial_balance
    
    goal_status = "Goal Not Applicable"
    if target_amount > 0:
        if net_savings >= target_amount:
            goal_status = "Goal Achieved"
        else:
            diff = target_amount - net_savings
            goal_status = f"Requires ${diff:.2f} more."
            
    return {
        "initial_balance": initial_balance,
        "final_balance": final_balance,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net_savings": round(net_savings, 2),
        "final_fhs": round(current_fhs, 2),
        "fhs_change": round(current_fhs - summary.get('latest_fhs', 50.0), 2),
        "time_horizon_months": months,
        "goal_status": goal_status,
        "simulation_goal": params.get('simulation_goal', 'General'),
        "daily_balances": [round(b, 2) for b in daily_balances[::30]], 
        "daily_fhs": [round(f, 2) for f in fhs_scores[::30]] 
    }

# 4. 改为 async def 并修复 JSON 序列化
async def generate_detailed_report(
    user_question: str, 
    simulation_data: Dict[str, Any], 
    initial_fhs_rating: str,
    budget_analysis: Dict[str, Any] = None 
) -> str:
    if not openai_client:
        return "OpenAI unavailable."
    
    # 🔴 修正这里：添加 default=str 参数
    # 这告诉 Python：遇到日期格式，直接把它转成字符串，不要报错
    data_str = json.dumps(simulation_data, indent=2, default=str)
    budget_str = json.dumps(budget_analysis, indent=2, default=str) if budget_analysis else "Not available"
    
    prompt = (
        f"You are a professional financial advisor. Answer user's question.\n"
        f"Question: {user_question}\n"
        f"Initial FHS: {initial_fhs_rating}\n"
        f"Budget Analysis: {budget_str}\n"
        f"Forecast Simulation: {data_str}\n"
        f"Use Markdown."
    )
    
    try:
        response = await openai_client.chat.completions.create(
            model=MODEL_MINI,
            messages=[
                {"role": "system", "content": "You are a helpful financial advisor."},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        logging.error(f"Report gen failed: {e}")
        return f"Simulation finished. Raw result: {data_str}"

async def generate_simulation_report(
    user_id: str,
    user_question: str,
    db: Any, 
    fhs_report_func: Any,
    lstm_report_func: Any,
    get_balance_func: Any,
    budget_analysis: Dict[str, Any] 
) -> Dict[str, Any]:
    
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API Key missing.")

    try:
        # await 异步函数
        params = await extract_simulation_parameters(user_question)
        logging.info(f"Extracted parameters: {params}")
        
        # 并行获取数据 (Optional Optimization: using asyncio.gather)
        fhs_report = await fhs_report_func(user_id)
        lstm_report = await lstm_report_func(user_id)
        initial_balance = await get_balance_func(user_id, db)
        
        if "error" in fhs_report or "error" in lstm_report:
            err = fhs_report.get("error") or lstm_report.get("error")
            raise HTTPException(status_code=400, detail=f"Analysis failed: {err}")

        # 运行纯数学计算 (同步)
        simulation_data = run_financial_simulation(
            params, fhs_report, lstm_report, initial_balance
        )

        if "error" in simulation_data:
             raise HTTPException(status_code=400, detail=simulation_data["error"])
        
        initial_fhs_rating = fhs_report.get('summary', {}).get('latest_rating', 'Unknown')
        
        # await 异步报告生成
        final_report_markdown = await generate_detailed_report(
            user_question, 
            simulation_data,
            initial_fhs_rating,
            budget_analysis 
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
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

# 5. 改为 async def
async def generate_general_chat_response(user_question: str) -> str:
    if not openai_client:
        return "OpenAI service is not configured."

    try:
        response = await openai_client.chat.completions.create(
            model=MODEL_MINI,
            messages=[
                {"role": "system", "content": "You are a helpful financial advisor."},
                {"role": "user", "content": user_question}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        logging.error(f"Chat failed: {e}")
        return "Service unavailable."