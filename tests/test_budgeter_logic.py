import sys
import os
from datetime import date
from collections import defaultdict

# Add current directory to path
sys.path.append(os.path.abspath("AIworkshop2"))

from budgeter import analyze_recent_transactions

def test_monthly_averages():
    print("Testing analyze_recent_transactions...")
    
    # Mock transactions over 2 months
    transactions = [
        {"transaction_date": "2023-10-01", "amount": 1000, "type": "Income"},
        {"transaction_date": "2023-10-15", "amount": 200, "type": "Expense", "category": "Food"},
        {"transaction_date": "2023-11-01", "amount": 2000, "type": "Income"},
        {"transaction_date": "2023-11-15", "amount": 400, "type": "Expense", "category": "Food"},
        {"transaction_date": "2023-11-20", "amount": 100, "type": "Expense", "category": "Transport"},
    ]
    
    analysis = analyze_recent_transactions(transactions)
    
    # Expected: 
    # Total Income: 3000 / 2 months = 1500
    # Average Food: (200 + 400) / 2 months = 300
    # Average Transport: 100 / 2 months = 50
    
    print(f"Analysis: {analysis}")
    
    assert analysis["avg_monthly_income"] == 1500.0, f"Expected 1500, got {analysis['avg_monthly_income']}"
    assert analysis["avg_monthly_spending"]["Food"] == 300.0, f"Expected 300, got {analysis['avg_monthly_spending']['Food']}"
    assert analysis["avg_monthly_spending"]["Transport"] == 50.0, f"Expected 50, got {analysis['avg_monthly_spending']['Transport']}"
    assert analysis["num_months_analyzed"] == 2
    
    print("✅ Monthly average tests passed!")

if __name__ == "__main__":
    try:
        test_monthly_averages()
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
