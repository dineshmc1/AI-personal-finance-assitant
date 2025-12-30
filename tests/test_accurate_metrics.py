import asyncio
import sys
import os
import datetime

# Add current directory to path
sys.path.append(os.path.abspath("AIworkshop2"))

from balance_manager import get_average_metrics_last_3_months, recalculate_user_history
import firebase_admin
from firebase_admin import credentials, firestore

# Mocking or using a test user
TEST_USER_ID = "SykmkOcfYPfIGB4WBW2wZv3e3Rn2" # Using the user from logs

async def test_accurate_metrics():
    print(f"Testing accurate metrics for user: {TEST_USER_ID}")
    
    # Initialize Firebase if not done
    if not firebase_admin._apps:
        cred = credentials.Certificate('./AIworkshop2/serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    
    # 1. Trigger recalculation to ensure monthly_balances is populated with income/expense
    print("Step 1: Recalculating user history...")
    recalc_result = await recalculate_user_history(TEST_USER_ID, db)
    print(f"Recalc Result: {recalc_result}")
    
    # 2. Fetch averages
    print("Step 2: Fetching 3-month averages...")
    metrics = await get_average_metrics_last_3_months(TEST_USER_ID, db)
    print(f"Fetched Metrics: {metrics}")
    
    # Validation
    assert "avg_monthly_income" in metrics
    assert "avg_monthly_spending" in metrics
    assert metrics["num_months"] <= 3
    
    print("✅ Verification Successful!")

if __name__ == "__main__":
    asyncio.run(test_accurate_metrics())
