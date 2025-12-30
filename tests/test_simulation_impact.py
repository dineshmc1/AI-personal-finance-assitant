import sys
import os

# Add current directory to path
sys.path.append(os.path.abspath("AIworkshop2"))

from simulation import run_financial_simulation

def test_car_loan_impact():
    print("Testing run_financial_simulation with car loan (DTI logic)...")
    
    # Baseline: User saves 3144/month
    fhs_report = {"summary": {"latest_fhs": 70.0}}
    lstm_report = {
        "forecast_results": [{"forecast_income": 4205, "forecast_expense": 1061}]
    }
    initial_balance = 20000
    
    # Scenario: Buy car, RM 900/month payment
    params = {
        "simulation_goal": "buy a car",
        "time_horizon_months": 12,
        "monthly_impact": -900,
        "one_time_impact": 0,
        "target_amount": 0
    }
    
    result = run_financial_simulation(params, fhs_report, lstm_report, initial_balance, currency="MYR")
    
    # Calculations:
    # Monthly Income: 4205
    # Monthly Expense: 1061 + 900 = 1961
    # Monthly Net Flow: 4205 - 1961 = 2244
    # 12 Months Net Savings: 2244 * 12 = 26928
    
    # FHS Logic:
    # DTI = 900 / 4205 = 0.214 (21.4%)
    # Initial penalty = 5 + (0.214 * 20) = 9.28
    # Start Score = 70 - 9.28 = 60.72
    # Daily Growth = (2244/1000 * 0.04 * (1 - 0.428)) - (0.05 * 0.214) 
    # Daily Growth = (2.244 * 0.04 * 0.572) - 0.0107 = 0.0513 - 0.0107 = 0.0406
    # 360 days Growth = 360 * 0.0406 = 14.6
    # Final FHS = 60.72 + 14.6 = 75.32
    
    print(f"Final Balance: {result['final_balance']}")
    print(f"Net Savings In Period: {result['net_savings_in_period']}")
    print(f"Final FHS: {result['final_fhs']}")
    print(f"DTI Ratio Impact: {result['dti_ratio_impact']}%")
    
    assert abs(result['net_savings_in_period'] - 26928.0) < 100
    assert 70 < result['final_fhs'] < 80 # FHS improves slowly but stays below 100
    
    print("✅ DTI-based simulation tests passed!")

if __name__ == "__main__":
    try:
        test_car_loan_impact()
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
