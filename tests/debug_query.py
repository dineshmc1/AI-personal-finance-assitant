import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase
if not firebase_admin._apps:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Assuming serviceAccountKey.json is in AIworkshop2 directory
    key_path = os.path.join(current_dir, '..', 'AIworkshop2', 'serviceAccountKey.json')
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

USER_ID = "SykmkOcfYPfIGB4WBW2wZv3e3Rn2"
YEAR = 2025
MONTHS = [10, 12]

print(f"--- Debugging Monthly Balances for User {USER_ID} ---")

for month in MONTHS:
    print(f"\nScanning for Month: {month}")
    
    # 1. Query with Integers
    print(f"[Query 1] integer year={YEAR}, integer month={month}")
    query = db.collection('monthly_balances')\
        .where("user_id", "==", USER_ID)\
        .where("year", "==", YEAR)\
        .where("month", "==", month)\
        .limit(1)
    
    docs = list(query.stream())
    print(f"  -> Found {len(docs)} docs")
    if docs:
        print(f"  -> Data: {docs[0].to_dict()}")

    # 2. Query with String Month (Just in case)
    print(f"[Query 2] integer year={YEAR}, string month='{month}'")
    query_str = db.collection('monthly_balances')\
        .where("user_id", "==", USER_ID)\
        .where("year", "==", YEAR)\
        .where("month", "==", str(month))\
        .limit(1)
        
    docs_str = list(query_str.stream())
    print(f"  -> Found {len(docs_str)} docs")
    if docs_str:
        print(f"  -> Data: {docs_str[0].to_dict()}")

    # 3. Direct ID Check
    doc_id = f"{USER_ID}_{YEAR}_{month}"
    print(f"[Direct ID] Check ID: {doc_id}")
    doc = db.collection('monthly_balances').document(doc_id).get()
    if doc.exists:
        print(f"  -> DOCUMENT EXISTS! ID matches.")
        print(f"  -> Data: {doc.to_dict()}")
    else:
        print(f"  -> Document NOT found by ID.")

print("\n--- Listing ALL docs for user (Limit 5) ---")
all_docs = db.collection('monthly_balances').where("user_id", "==", USER_ID).limit(5).stream()
for d in all_docs:
    data = d.to_dict()
    print(f"Doc ID: {d.id}")
    print(f"  Month Type: {type(data.get('month'))} Value: {data.get('month')}")
    print(f"  Year Type: {type(data.get('year'))} Value: {data.get('year')}")
    print(f"  User ID: {data.get('user_id')}")
    print("-" * 20)
