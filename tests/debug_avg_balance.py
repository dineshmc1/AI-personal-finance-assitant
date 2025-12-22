import firebase_admin
from firebase_admin import credentials, firestore
import os
import datetime

# Initialize Firebase
if not firebase_admin._apps:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    key_path = os.path.join(current_dir, '..', 'AIworkshop2', 'serviceAccountKey.json')
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
USER_ID = "SykmkOcfYPfIGB4WBW2wZv3e3Rn2"

print(f"--- Debugging Avg Balance for User {USER_ID} ---")

# Simulate the logic
stats_ref = db.collection('monthly_balances').where("user_id", "==", USER_ID)\
    .order_by("year", direction=firestore.Query.DESCENDING)\
    .order_by("month", direction=firestore.Query.DESCENDING)\
    .limit(5)
    
docs = list(stats_ref.stream())
print(f"Found {len(docs)} documents (Limit 5)")

balances = []
now = datetime.datetime.now()
print(f"Current Date: {now.year}-{now.month}")

for doc in docs:
    data = doc.to_dict()
    doc_year = data.get('year')
    doc_month = data.get('month')
    
    # Val
    val = data.get('balance', data.get('monthly_balance', 0.0))
    
    print(f"Checking Doc: {doc_year}-{doc_month} | Balance: {val}")

    if doc_year == now.year and doc_month == now.month:
        print(f"  -> SKIPPING CURRENT MONTH")
        continue

    balances.append(float(val))
    if len(balances) == 3:
        break

print(f"Selected Balances: {balances}")
if balances:
    avg = sum(balances) / len(balances)
    print(f"Calculated Average: {avg}")
else:
    print("No balances selected.")
