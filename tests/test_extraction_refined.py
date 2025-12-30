import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.path.abspath("AIworkshop2"))

from simulation import extract_simulation_parameters

async def test_loan_extraction():
    print("Testing extraction for 9-year car loan scenario...")
    query = "What if I buy a car worth 98k in loan. Monthly payment would be rm 1000 for 9 years."
    
    params = await extract_simulation_parameters(query)
    print(f"Extracted Params: {params}")
    
    # Assertions
    assert params['time_horizon_months'] == 108, f"Expected 108 months, got {params['time_horizon_months']}"
    assert params['one_time_impact'] == 0 or params['one_time_impact'] > -5000, f"98k detected as one-time cost! Got {params['one_time_impact']}"
    assert params['monthly_impact'] == -1000, f"Expected -1000 monthly impact, got {params['monthly_impact']}"
    
    print("✅ Extraction Verification Successful!")

if __name__ == "__main__":
    asyncio.run(test_loan_extraction())
