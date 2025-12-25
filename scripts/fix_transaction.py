import requests
import datetime
import os
from dotenv import load_dotenv

# Load env from parent directory (or current)
load_dotenv()
# Load env from AIworkshop2 (as running from root)
load_dotenv('AIworkshop2/.env')

BASE_URL = "http://127.0.0.1:8000"
API_KEY = os.getenv("FIREBASE_API_KEY")
EMAIL = os.getenv("TEST_USER_EMAIL")
PASSWORD = os.getenv("TEST_USER_PASSWORD")

def get_token():
    if not API_KEY or not EMAIL or not PASSWORD:
        print("Missing credentials in .env")
        return None
        
    auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
    payload = {
        "email": EMAIL,
        "password": PASSWORD,
        "returnSecureToken": True
    }
    try:
        resp = requests.post(auth_url, data=payload)
        resp.raise_for_status()
        return resp.json().get('idToken')
    except Exception as e:
        print(f"Auth failed: {e}")
        return None

def fix_transaction():
    token = get_token()
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get all transactions
    try:
        response = requests.get(f"{BASE_URL}/transactions/", headers=headers)
        response.raise_for_status()
        transactions = response.json()
        
        # 2. Find "Farm Fresh Pure"
        target_tx = None
        print(f"Searching through {len(transactions)} transactions...")
        for tx in transactions:
            desc = tx.get('merchant', '') or tx.get('description', '')
            print(f" - {desc}")
            # Check widely for the name
            if 'Farm Fresh Pure' in desc or 'FARM FRESH PURE' in desc or 'Farm fresh pure' in desc:
                target_tx = tx
                break
        
        if not target_tx:
            print("Transaction 'Farm Fresh Pure' not found.")
            return

        print(f"Found Transaction: {target_tx['id']} - {target_tx.get('merchant')} Date: {target_tx['transaction_date']}")

        # 3. Update date to today
        today_str = datetime.date.today().isoformat()
        
        payload = {
            "transaction_date": today_str,
            "transaction_time": target_tx.get('transaction_time', '12:00'),
            "type": target_tx.get('type'),
            "category": target_tx.get('category'),
            "amount": target_tx.get('amount'),
            "merchant": target_tx.get('merchant'),
            "account_id": target_tx.get('account_id')
        }

        print(f"Updating to date: {today_str}...")
        
        update_url = f"{BASE_URL}/transactions/{target_tx['id']}"
        update_response = requests.put(update_url, json=payload, headers=headers)
        update_response.raise_for_status()
        
        print("Success! Transaction updated.")
        print(update_response.json())

    except Exception as e:
        print(f"Error: {e}")
        if hasattr(e, 'response') and e.response:
             print(e.response.text)

if __name__ == "__main__":
    fix_transaction()
