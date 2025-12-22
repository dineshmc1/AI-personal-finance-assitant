
import firebase_admin
from firebase_admin import credentials, firestore, initialize_app
import asyncio
from balance_manager import recalculate_user_history

# Setup Firebase (Simplified for script)
cred_path = './serviceAccountKey.json'
try:
    cred = credentials.Certificate(cred_path)
    initialize_app(cred, {'storageBucket': "ai-personal-finance-assi-bdf76.firebasestorage.app"})
except ValueError:
    pass # Already initialized

db = firestore.client()

async def backfill_all_users():
    print("Fetching distinct users from transactions...")
    transactions_ref = db.collection('transactions')
    # Firestore doesn't support "distinct" easily on stream without composite index.
    # We'll just stream all and deduplicate in python (not efficient for millions, but fine for workshop).
    docs = transactions_ref.select(['user_id']).stream()
    
    unique_users = set()
    for doc in docs:
        if doc.exists:
             data = doc.to_dict()
             if 'user_id' in data:
                 unique_users.add(data['user_id'])
    
    print(f"Found {len(unique_users)} unique users.")
    
    count = 0
    for user_id in unique_users:
        print(f"Recalculating history for user: {user_id}")
        result = await recalculate_user_history(user_id, db)
        print(f"Result for {user_id}: {result}")
        count += 1
        
    print(f"Backfill completed for {count} users.")

if __name__ == "__main__":
    asyncio.run(backfill_all_users())
