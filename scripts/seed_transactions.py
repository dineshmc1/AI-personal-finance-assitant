import firebase_admin
from firebase_admin import credentials, firestore
import random
from datetime import datetime, timedelta
import json

# ================= CONFIGURATION =================
# Replace with your actual file path
SERVICE_ACCOUNT_KEY = 'serviceAccountKey.json' 
USER_ID = "SykmkOcfYPfIGB4WBW2wZv3e3Rn2"
ACCOUNT_ID = "oBN6PhMGHuT1HZLAt1Ve"

# Initialize Firebase (if not already initialized)
if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY)
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ================= DATA GENERATION LOGIC =================

def generate_synthetic_data():
    start_date = datetime(2025, 1, 1)
    end_date = datetime(2025, 12, 22)
    
    transactions = []
    
    # Trackers for aggregation
    monthly_stats = {} # Key: "2025_1" -> {income: 0, expense: 0, balance: 0}
    total_balance = 0

    current_date = start_date
    while current_date <= end_date:
        daily_txs = []
        
        day_str = current_date.strftime("%Y-%m-%d")
        month_key = f"{current_date.year}_{current_date.month}"
        
        if month_key not in monthly_stats:
            monthly_stats[month_key] = {"user_id": USER_ID, "month": current_date.month, "year": current_date.year, "balance": 0, "total_income": 0, "total_expense": 0}

        # --- 1. DAILY FOOD (Almost every day) ---
        if random.random() > 0.1: # 90% chance of eating out
            places = [("Mamak Bistro", 12), ("Kafe UTeM", 8), ("McDonalds", 25), ("Warung Tomyam", 15)]
            place, base_cost = random.choice(places)
            amount = round(random.uniform(base_cost - 2, base_cost + 5), 2)
            daily_txs.append({
                "type": "Expense", "category": "Food", "merchant": place, "amount": amount
            })

        # --- 2. FUEL (Weekly) ---
        if current_date.weekday() == 6: # Every Sunday
            daily_txs.append({
                "type": "Expense", "category": "Transport", "merchant": "Petronas", "amount": 50.00
            })

        # --- 3. FREELANCE INCOME (Irregular, 2-4 times a month) ---
        # 10% chance on any given weekday
        if current_date.weekday() < 5 and random.random() < 0.12:
            projects = [
                ("AI Chatbot Dev", 1200), ("React Native Fix", 400), 
                ("Python Scripting", 300), ("Full Stack App", 2500)
            ]
            job, base_pay = random.choice(projects)
            amount = round(random.uniform(base_pay, base_pay + 200), 2)
            daily_txs.append({
                "type": "Income", "category": "Freelance", "merchant": job, "amount": amount
            })

        # --- 4. CHESS COACHING (Weekends) ---
        if current_date.weekday() >= 5: # Sat or Sun
            hours = random.choice([2, 3, 4])
            amount = hours * 40 # RM 40/hr
            daily_txs.append({
                "type": "Income", "category": "Side Hustle", "merchant": "Chess Coaching", "amount": amount
            })

        # --- 5. CAR MAINTENANCE & SHOPPING (Occasional) ---
        if current_date.day == 15 and random.random() < 0.3: # Once a month maybe
            daily_txs.append({
                "type": "Expense", "category": "Shopping", "merchant": "Shopee", "amount": random.choice([45, 120, 200])
            })
        
        if current_date.month % 4 == 0 and current_date.day == 10: # Every 4 months
            daily_txs.append({
                "type": "Expense", "category": "Car", "merchant": "Workshop Service", "amount": 250.00
            })

        # --- 6. UTeM FEES (Jan and Aug) ---
        if (current_date.month == 1 or current_date.month == 8) and current_date.day == 5:
             daily_txs.append({
                "type": "Expense", "category": "Education", "merchant": "UTeM Bursary", "amount": 1200.00
            })

        # Process the day's transactions
        for tx in daily_txs:
            # Generate timestamps
            hour = random.randint(9, 21)
            minute = random.randint(0, 59)
            time_str = f"{hour:02d}:{minute:02d}"

            tx_data = {
                "account_id": ACCOUNT_ID,
                "amount": tx["amount"],
                "category": tx["category"],
                "merchant": tx["merchant"],
                "transaction_date": day_str,
                "transaction_time": time_str,
                "type": tx["type"],
                "user_id": USER_ID,
            }
            transactions.append(tx_data)

            # Update Aggregates
            if tx["type"] == "Income":
                total_balance += tx["amount"]
                monthly_stats[month_key]["balance"] += tx["amount"]
                monthly_stats[month_key]["total_income"] += tx["amount"]
            else:
                total_balance -= tx["amount"]
                monthly_stats[month_key]["balance"] -= tx["amount"] # Expenses reduce balance
                monthly_stats[month_key]["total_expense"] += tx["amount"]

        current_date += timedelta(days=1)

    return transactions, monthly_stats, total_balance

# ================= UPLOAD LOGIC =================

def upload_data(transactions, monthly_stats, total_balance):
    print(f"Generated {len(transactions)} transactions.")
    print(f"Calculated Final Balance: RM {total_balance:.2f}")

    # 1. Save to JSON
    with open('synthetic_transactions.json', 'w') as f:
        json.dump(transactions, f, indent=4)
    print("Saved to synthetic_transactions.json")

    # 2. Upload Transactions (Batching for speed)
    batch = db.batch()
    batch_counter = 0
    print("Uploading transactions...")
    
    for tx in transactions:
        doc_ref = db.collection('transactions').document() # Auto-ID
        batch.set(doc_ref, tx)
        batch_counter += 1

        if batch_counter >= 400: # Firestore batch limit is 500
            batch.commit()
            batch = db.batch()
            batch_counter = 0
            print(".", end="", flush=True)
    
    if batch_counter > 0:
        batch.commit()
    print("\nTransactions uploaded.")

    # 3. Upload Monthly Stats
    print("Uploading monthly balances...")
    batch = db.batch()
    for key, stats in monthly_stats.items():
        # Doc ID format: user_id_2025_1
        doc_id = f"{USER_ID}_{stats['year']}_{stats['month']}"
        doc_ref = db.collection('monthly_balances').document(doc_id)
        batch.set(doc_ref, stats)
    batch.commit()

    # 4. Update Main Account Balance
    print("Updating main account balance...")
    account_ref = db.collection('accounts').document(ACCOUNT_ID)
    account_ref.update({"current_balance": total_balance})

    print("DONE! Database seeded successfully.")

if __name__ == "__main__":
    txs, m_stats, bal = generate_synthetic_data()
    # Ask for confirmation before pushing
    confirm = input(f"Ready to push {len(txs)} transactions to Firestore? (y/n): ")
    if confirm.lower() == 'y':
        upload_data(txs, m_stats, bal)
    else:
        print("Aborted. Data saved to JSON only (if you ran that part).")