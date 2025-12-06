# AI workshop 2/accounts.py
import firebase_admin
from firebase_admin import firestore
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Annotated, Optional
from models import AccountCreate, AccountDB
from auth_deps import get_current_user_id 

# === 移除顶层的 db 初始化，防止导入时报错 ===
# try:
#     db = firestore.client()
# except ValueError:
#     db = None

accounts_router = APIRouter(
    prefix="/accounts",
    tags=["Accounts"],
)

# === 新增：获取 DB 的辅助函数 ===
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
    db = get_db() # <--- 在函数内部获取 DB
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
    db = get_db() # <--- 在函数内部获取 DB
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
    db = get_db() # <--- 在函数内部获取 DB
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
    # 这个函数通常由 main.py 调用，db 是传进来的，所以不需要修改
    try:
        account_ref = db.collection('accounts').document(account_id)
        
        change = amount if is_income else -amount

        account_ref.update({
            'current_balance': firestore.firestore.Increment(change)
        })
    except Exception as e:
        print(f"CRITICAL: Failed to update balance for account {account_id}: {e}")
        
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update account balance during transaction operation.")


# AI workshop 2/accounts.py
# import firebase_admin
# from firebase_admin import firestore
# from fastapi import APIRouter, HTTPException, status, Depends
# from typing import List, Annotated, Optional
# from models import AccountCreate, AccountDB
# from auth_deps import get_current_user_id 

# try:
#     db = firestore.client()
# except ValueError:
#     db = None


# accounts_router = APIRouter(
#     prefix="/accounts",
#     tags=["Accounts"],
# )

# @accounts_router.post("/", response_model=AccountDB, status_code=status.HTTP_201_CREATED)
# async def create_account(
#     account_data: AccountCreate,
#     user_id: Annotated[str, Depends(get_current_user_id)]
# ):
#     """
#     Creates a new account for the authenticated user.
#     """
#     try:
#         account_dict = {
#             "name": account_data.name,
#             "user_id": user_id,
#             "current_balance": 0.0, 
#         }

#         accounts_ref = db.collection('accounts')
#         doc_ref = accounts_ref.add(account_dict)
        
#         return AccountDB(id=doc_ref[1].id, **account_dict)

#     except Exception as e:
#         print(f"Error creating account: {e}")
#         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create account.")


# @accounts_router.get("/", response_model=List[AccountDB])
# async def list_accounts(
#     user_id: Annotated[str, Depends(get_current_user_id)]
# ):
#     """
#     Retrieves all accounts for the authenticated user.
#     """
#     if not db:
#         raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")
#     try:
#         accounts_ref = db.collection('accounts').where("user_id", "==", user_id).order_by("name")
#         docs = accounts_ref.stream()
        
#         accounts: List[AccountDB] = []
#         for doc in docs:
#             account_data = doc.to_dict()
#             accounts.append(AccountDB(id=doc.id, **account_data))
            
#         return accounts
        
#     except Exception as e:
#         print(f"Error listing accounts: {e}")
#         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve accounts from database.")


# @accounts_router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
# async def delete_account(
#     account_id: str,
#     user_id: Annotated[str, Depends(get_current_user_id)]
# ):
#     """
#     Deletes an account by its ID. It also deletes all associated transactions.
#     """
#     try:
#         account_doc_ref = db.collection('accounts').document(account_id)
#         account_doc = account_doc_ref.get()

#         if not account_doc.exists:
#             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
        
#         if account_doc.to_dict().get("user_id") != user_id:
#             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this account.")
            
#         account_doc_ref.delete()
        
#         transactions_ref = db.collection('transactions').where("user_id", "==", user_id).where("account_id", "==", account_id)
        
#         batch = db.batch()
#         for doc in transactions_ref.stream():
#             batch.delete(doc.reference)
#         batch.commit()
        
#         return
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         print(f"Error deleting account: {e}")
#         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete account.")
        
# def update_account_balance(account_id: str, amount: float, is_income: bool, db: firebase_admin.firestore.client) -> None:
#     """
#     Internal function to adjust the account balance based on a transaction.
#     Positive amount is addition, negative is subtraction.
#     """
#     try:
#         account_ref = db.collection('accounts').document(account_id)
        
#         change = amount if is_income else -amount

#         account_ref.update({
#             'current_balance': firestore.firestore.Increment(change)
#         })
#     except Exception as e:
#         print(f"CRITICAL: Failed to update balance for account {account_id}: {e}")
        
#         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update account balance during transaction operation.")