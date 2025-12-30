import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.path.abspath("AIworkshop2"))

from simulation import extract_simulation_parameters

async def test_extraction():
    print("Testing extraction for: 'What if I buy a car in loan for 100k. Monthly payment would be rm 900 for 9 years.'")
    question = "What if I buy a car in loan for 100k. Monthly payment would be rm 900 for 9 years."
    params = await extract_simulation_parameters(question)
    
    print(f"Extracted Params: {params}")
    
    # Expected:
    # monthly_impact: -900
    # time_horizon_months: 108
    # one_time_impact: 0 or -100000 (though 100k is the loan, not downpayment, but usually users mean price)
    
    assert params["monthly_impact"] == -900, f"Expected -900, got {params['monthly_impact']}"
    assert params["time_horizon_months"] == 108, f"Expected 108, got {params['time_horizon_months']}"
    
    print("✅ Extraction tests passed!")

if __name__ == "__main__":
    asyncio.run(test_extraction())
