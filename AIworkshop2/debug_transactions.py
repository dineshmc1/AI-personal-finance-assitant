import firebase_admin
from firebase_admin import credentials, firestore
import os

if not firebase_admin._apps:
    cred = credentials.Certificate('./serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

print(f"--- Checking ALL Transactions ---")

transactions = db.collection('transactions').stream()
count = 0
for doc in transactions:
    data = doc.to_dict()
    print(f"ID: {doc.id} | Date: {data.get('transaction_date')} | Amount: {data.get('amount')} | Type: {data.get('type')} | Merchant: {data.get('merchant')}")
    count += 1

print(f"--- Total Transactions Found: {count} ---")
