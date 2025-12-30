import sys
import os

# Add current directory to path
sys.path.append(os.path.abspath("AIworkshop2"))

from simulation import run_financial_simulation

def test_car_loan_impact():
    print("DEBUG: Starting test_car_loan_impact (Reverted keys)...")
    
    fhs_report = {"summary": {"latest_fhs": 70.0}}
    # Mock monthly data (1 entry)
    lstm_report = {
        "forecast_results": [{"forecast_income": 4205, "forecast_expense": 1061}]
    }
    initial_balance = 20000
    
    params = {
        "simulation_goal": "buy a car",
        "time_horizon_months": 12,
        "monthly_impact": -900,
        "one_time_impact": 0,
        "target_amount": 0
    }
    
    result = run_financial_simulation(params, fhs_report, lstm_report, initial_balance, currency="MYR")
    
    print(f"DEBUG_FINAL_FHS: {result['final_fhs']}")
    print(f"DEBUG_NET_SAVINGS: {result['net_savings']}") # Reverted key
    print(f"DEBUG_DTI: {result['dti_ratio_impact']}")
    print(f"DEBUG_TOTAL_INCOME: {result['total_income']}")
    print(f"DEBUG_TOTAL_EXPENSE: {result['total_expense']}")
    print(f"DEBUG_DAILY_BALANCES_LEN: {len(result['daily_balances'])}")

if __name__ == "__main__":
    test_car_loan_impact()
