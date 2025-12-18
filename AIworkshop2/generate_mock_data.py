# AIworkshop2/generate_mock_data.py
import firebase_admin
from firebase_admin import credentials, firestore
import random
from datetime import datetime, timedelta
import uuid

USER_ID = "Ko9A6lWk1LX7bclLEIf3ujLJhKx2" 
ACCOUNT_ID = "" 

DAYS_TO_GENERATE = 100 
START_DATE = datetime.now() - timedelta(days=DAYS_TO_GENERATE)

EXPENSE_CATEGORIES = ["Food", "Transport", "Shopping", "Entertainment", "Bills", "Housing", "Vehicle"]
MERCHANTS = {
    "Food": ["McDonalds", "KFC", "Starbucks", "Grocery Store", "Local Cafe"],
    "Transport": ["Grab", "Uber", "Shell", "Petronas", "Train Ticket"],
    "Shopping": ["Uniqlo", "H&M", "Shopee", "Lazada", "IKEA"],
    "Entertainment": ["Netflix", "Spotify", "Cinema", "Steam Games"],
    "Bills": ["Tenaga Nasional", "Air Selangor", "Maxis", "TM Unifi"],
    "Housing": ["Rent", "Management Fee"],
    "Vehicle": ["Car Loan", "Insurance", "Repair Shop"]
}

# === 初始化 Firebase ===
if not firebase_admin._apps:
    cred = credentials.Certificate('./serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
db = firestore.client()

def get_default_account():
    docs = db.collection('accounts').where("user_id", "==", USER_ID).limit(1).stream()
    for doc in docs:
        return doc.id
    return None

def generate_data():
    print(f"🚀 Starting data generation for User: {USER_ID}...")
    
    target_account_id = ACCOUNT_ID
    if not target_account_id or target_account_id == "你的_ACCOUNT_ID_在这里":
        target_account_id = get_default_account()
        if not target_account_id:
            print("❌ No account found! Please create an account in the App first.")
            return

    print(f"✅ Using Account ID: {target_account_id}")
    
    batch = db.batch()
    batch_count = 0
    total_income = 0
    total_expense = 0
    
    current_date = START_DATE
    
    while current_date <= datetime.now():
        day_str = current_date.strftime("%Y-%m-%d")
        
        if current_date.day == 1 or current_date.day == 15:
            income_amount = 3500.0 if current_date.day == 1 else 1500.0 
            doc_ref = db.collection('transactions').document()
            batch.set(doc_ref, {
                "user_id": USER_ID,
                "account_id": target_account_id,
                "type": "Income",
                "category": "Salary",
                "amount": income_amount,
                "merchant": "Company Payroll",
                "transaction_date": day_str,
                "transaction_time": "09:00"
            })
            total_income += income_amount
            batch_count += 1

        daily_tx_count = random.randint(0, 3)
        for _ in range(daily_tx_count):
            cat = random.choice(EXPENSE_CATEGORIES)
            merch = random.choice(MERCHANTS[cat])
            
            if cat == "Housing": 
                if current_date.day == 5: 
                    amt = 1200.0
                else: continue
            elif cat == "Bills":
                amt = random.uniform(50, 150)
            else:
                amt = random.uniform(10, 150)
            
            doc_ref = db.collection('transactions').document()
            batch.set(doc_ref, {
                "user_id": USER_ID,
                "account_id": target_account_id,
                "type": "Expense",
                "category": cat,
                "amount": round(amt, 2),
                "merchant": merch,
                "transaction_date": day_str,
                "transaction_time": f"{random.randint(10, 22)}:{random.randint(10, 59)}"
            })
            total_expense += amt
            batch_count += 1
        
        if batch_count >= 400:
            batch.commit()
            print(f"  ... Committed {batch_count} transactions ...")
            batch = db.batch()
            batch_count = 0
            
        current_date += timedelta(days=1)

    if batch_count > 0:
        batch.commit()

    final_balance = total_income - total_expense
    account_ref = db.collection('accounts').document(target_account_id)
    account_ref.update({"current_balance": firestore.Increment(final_balance)})
    
    print(f"🎉 Done! Generated transactions from {START_DATE.date()} to today.")
    print(f"💰 Total Income: {total_income:.2f}")
    print(f"💸 Total Expense: {total_expense:.2f}")
    print(f"💵 Net Flow: {total_income - total_expense:.2f}")
    print("👉 Now refresh your App to see the magic!")

if __name__ == "__main__":
    generate_data()