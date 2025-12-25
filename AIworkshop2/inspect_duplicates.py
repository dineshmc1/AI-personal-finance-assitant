import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate('./serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("--- Inspecting Transactions with Amount 13.90 ---")
docs = db.collection('transactions').where('amount', '==', 13.90).stream()
for d in docs:
    data = d.to_dict()
    print(f"ID: {d.id}")
    print(f"  Date: {data.get('transaction_date')}")
    print(f"  Time: {data.get('transaction_time')}")
    print(f"  Merchant: {data.get('merchant')}")
    print(f"  Category: {data.get('category')}")
    print("-" * 20)
