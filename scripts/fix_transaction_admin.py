import firebase_admin
from firebase_admin import credentials, firestore
import datetime
import os

# Path to service account key
CRED_PATH = 'AIworkshop2/serviceAccountKey.json'

def fix_transaction_admin():
    # 1. Initialize Firebase Admin
    if not firebase_admin._apps:
        cred = credentials.Certificate(CRED_PATH)
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    
    print("Searching Firestore for 'Farm Fresh Pure'...")
    
    # 2. Search all transactions
    # Note: We can't do a 'contains' query easily in Firestore, so we might need to fetch all or guess the field.
    # The logs showed "FARM FRESH PURE". Let's try to query by merchant or description if exact match, or fetch all.
    # Fetching all might be heavy if production, but for dev it should be fine.
    
    transactions_ref = db.collection('transactions')
    docs = transactions_ref.stream()
    
    target_doc = None
    count = 0
    for doc in docs:
        count += 1
        data = doc.to_dict()
        desc = data.get('merchant', '') or data.get('description', '')
        # Case insensitive check
        if 'farm fresh pure' in str(desc).lower():
            target_doc = doc
            print(f"FOUND: ID={doc.id}, Desc={desc}, Date={data.get('transaction_date')}")
            break
            
    print(f"Scanned {count} documents.")
    
    if not target_doc:
        print("Transaction not found in Firestore.")
        return

    # 3. Update date to today
    today_str = datetime.date.today().isoformat()
    # Also update 'date' object field if it exists as timestamp (some implementations use both string and timestamp)
    
    print(f"Updating document {target_doc.id} to date {today_str}...")
    
    # Update dictionary
    updates = {
        'transaction_date': today_str
    }
    
    target_doc.reference.update(updates)
    print("Update complete.")

if __name__ == "__main__":
    fix_transaction_admin()
