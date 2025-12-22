# AI workshop 2/accounts.py
import firebase_admin
from firebase_admin import firestore
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Annotated, Optional
from models import AccountCreate, AccountDB
from auth_deps import get_current_user_id 

accounts_router = APIRouter(
    prefix="/accounts",
    tags=["Accounts"],
)

def get_db():
    try:
        return firestore.client()
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

@accounts_router.post("/", response_model=AccountDB, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_data: AccountCreate,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """
    Creates a new account for the authenticated user.
    """
    db = get_db() 
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        account_dict = {
            "name": account_data.name,
            "user_id": user_id,
            "current_balance": 0.0, 
        }

        accounts_ref = db.collection('accounts')
        doc_ref = accounts_ref.add(account_dict)
        
        return AccountDB(id=doc_ref[1].id, **account_dict)

    except Exception as e:
        print(f"Error creating account: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create account.")


@accounts_router.get("/", response_model=List[AccountDB])
async def list_accounts(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """
    Retrieves all accounts for the authenticated user.
    """
    db = get_db() 
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        accounts_ref = db.collection('accounts').where("user_id", "==", user_id).order_by("name")
        docs = accounts_ref.stream()
        
        accounts: List[AccountDB] = []
        for doc in docs:
            account_data = doc.to_dict()
            accounts.append(AccountDB(id=doc.id, **account_data))
            
        return accounts
        
    except Exception as e:
        print(f"Error listing accounts: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve accounts.")


@accounts_router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """
    Deletes an account by its ID. It also deletes all associated transactions.
    """
    db = get_db() 
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        account_doc_ref = db.collection('accounts').document(account_id)
        account_doc = account_doc_ref.get()

        if not account_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
        
        if account_doc.to_dict().get("user_id") != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this account.")
            
        account_doc_ref.delete()
        
        transactions_ref = db.collection('transactions').where("user_id", "==", user_id).where("account_id", "==", account_id)
        
        batch = db.batch()
        for doc in transactions_ref.stream():
            batch.delete(doc.reference)
        batch.commit()
        
        return
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting account: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete account.")
        

def update_account_balance(account_id: str, amount: float, is_income: bool, db: firebase_admin.firestore.client) -> None:
    """
    Internal function to adjust the account balance based on a transaction.
    Positive amount is addition, negative is subtraction.
    """
    try:
        account_ref = db.collection('accounts').document(account_id)
        
        change = amount if is_income else -amount

        account_ref.update({
            'current_balance': firestore.firestore.Increment(change)
        })
    except Exception as e:
        print(f"CRITICAL: Failed to update balance for account {account_id}: {e}")
        
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update account balance during transaction operation.")

def update_monthly_balance(user_id: str, date_obj, amount: float, is_income: bool, db: firebase_admin.firestore.client) -> None:
    """
    Updates the separate 'monthly_balances' collection.
    Document ID format: {user_id}_{yyyy}_{mm}
    """
    try:
        year = date_obj.year
        month = date_obj.month
        doc_id = f"{user_id}_{year}_{month}"
        
        doc_ref = db.collection('monthly_balances').document(doc_id)
        
        # Calculate signed change: Income adds, Expense subtracts
        change = amount if is_income else -amount
        
        # Use set with merge=True to ensure document exists, but Increment needs update or set with merge
        # firestore.Increment works with set(..., merge=True)
        # UPDATED: Using 'balance' field as per user requirement, maintaining monthly_balance for safety if needed, 
        # but the request explicitly asked about 'balance' field in DB. We will stick to 'balance'.
        doc_ref.set({
            "user_id": user_id,
            "year": year,
            "month": month,
            "balance": firestore.firestore.Increment(change),
            "monthly_balance": firestore.firestore.Increment(change) # Keep for backward compat if needed, or remove later
        }, merge=True)
        
    except Exception as e:
        print(f"CRITICAL: Failed to update monthly balance for user {user_id}: {e}")
        # Non-blocking error, just log it. We don't want to fail the transaction just because stats failed? 
        # But for consistency, maybe we should. Let's log heavily.

@accounts_router.get("/balance/monthly")
async def get_monthly_balance(
    year: int, 
    month: int,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """
    Get the specific monthly balance (Income - Expense) for the requested month.
    """
    db = get_db()
    if not db:
       raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
       
    # Use Query instead of direct ID to catch cases where ID might be different (e.g. legacy or manual data)
    try:
        print(f"DEBUG_MONTHLY: Fetching for User={user_id}, Year={year}, Month={month}")
        
        # Check for numeric equality
        query = db.collection('monthly_balances')\
            .where("user_id", "==", user_id)\
            .where("year", "==", year)\
            .where("month", "==", month)\
            .limit(1)
            
        docs = list(query.stream())
        print(f"DEBUG_MONTHLY: Found {len(docs)} documents.")
        
        if docs:
            data = docs[0].to_dict()
            print(f"DEBUG_MONTHLY: Doc Data: {data}")
            # Prefer 'balance', fallback to 'monthly_balance'
            val = data.get("balance")
            if val is None:
                val = data.get("monthly_balance", 0.0)
            return {"balance": val}
        else:
            # Fallback: Try string query if int failed? Or check ID reconstruction
            doc_id = f"{user_id}_{year}_{month}"
            print(f"DEBUG_MONTHLY: Query failed, trying direct ID: {doc_id}")
            direct_doc = db.collection('monthly_balances').document(doc_id).get()
            if direct_doc.exists:
                print("DEBUG_MONTHLY: Direct ID found!")
                data = direct_doc.to_dict()
                val = data.get("balance", data.get("monthly_balance", 0.0))
                return {"balance": val}
            
            # Last resort debugging: List ANY monthly balance for this user
            all_user_docs = list(db.collection('monthly_balances').where("user_id", "==", user_id).limit(2).stream())
            print(f"DEBUG_MONTHLY: Sample docs for user: {[d.to_dict() for d in all_user_docs]}")
            
            return {"balance": 0.0}
            
    except Exception as e:
        print(f"Error getting monthly balance: {e}")
        import traceback
        traceback.print_exc()
        return {"balance": 0.0}



