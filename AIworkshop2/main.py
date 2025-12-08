# AI workshop 2/main.py
import firebase_admin
from firebase_admin import initialize_app, credentials, firestore, auth, storage 
from models import Transaction, TransactionDB, AccountDB 
from vlm import extract_transactions_from_data, VLMTransaction 
from fhsm import generate_fhs_report, classify_fhs
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Path, Query
from lstm import generate_lstm_forecast 
from typing import Annotated, List, Dict, Any, Optional
from datetime import date
import base64
import time
from pathlib import Path as PathLib
from accounts import accounts_router, update_account_balance 
from auth_deps import get_current_user_id 
from goals import goals_router
from rl import generate_rl_optimization_report
from simulation import generate_simulation_report as run_simulation, generate_general_chat_response
from subscription import get_recurring_report
from calender import calendar_router
from budgeter import generate_auto_budget, analyze_recent_transactions
from debt import debt_router
from twin import twin_router
from fastapi.responses import FileResponse
from pathlib import Path
import os
from fastapi.middleware.cors import CORSMiddleware
import datetime
from categories import categories_router
import traceback
from models import UserSignup

FIREBASE_CREDENTIAL_PATH = './serviceAccountKey.json'
FIREBASE_STORAGE_BUCKET = "ai-personal-finance-assi-bdf76.firebasestorage.app" 

try:
    cred = credentials.Certificate(FIREBASE_CREDENTIAL_PATH)
    app_instance = initialize_app(cred, {'storageBucket': FIREBASE_STORAGE_BUCKET}) 
    storage_bucket = storage.bucket() 
except Exception as e:
    print(f"Firebase Initialization Error: {e}")

def get_db():
    try:
        return firestore.client()
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

app = FastAPI(
    title="AI Personal Finance Assistant Backend",
    description="Backend API for managing transactions, accounts, and generating FHS reports.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts_router)
app.include_router(goals_router)
app.include_router(calendar_router)
app.include_router(debt_router)
app.include_router(twin_router)
app.include_router(categories_router)


def check_account_ownership(user_id: str, account_id: str, db: Any):
    """Utility to verify if the account exists and belongs to the user."""
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
        
    account_doc = db.collection('accounts').document(account_id).get()
    
    if not account_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account ID '{account_id}' not found.")
        
    if account_doc.to_dict().get("user_id") != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account does not belong to the user.")

@app.get("/", tags=["Health"])
async def root():
    return {"message": "AI Personal Finance Assistant API is Running!", "status": "OK"}

@app.post("/auth/signup", status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserSignup):
    db = get_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        user_record = auth.create_user(
            email=user_data.email,
            password=user_data.password,
            display_name=user_data.username
        )
        
        default_account = {
            "name": user_data.username if user_data.username else "Cash",
            "user_id": user_record.uid,
            "current_balance": 0.0
        }
        
        db.collection('accounts').add(default_account)
        
        return {"message": "User created successfully", "user_id": user_record.uid}

    except auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="Email already exists")
    except Exception as e:
        print(f"Signup Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/transactions/manual", response_model=TransactionDB, status_code=status.HTTP_201_CREATED)
async def create_manual_transaction(
    transaction_data: Transaction,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """
    Manually creates a new transaction and adds it to the user's specified account.
    Requires an 'account_id' in the request body.
    """
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        check_account_ownership(user_id, transaction_data.account_id, db)
        
        transaction_dict = transaction_data.model_dump()
        transaction_dict['user_id'] = user_id

        transaction_dict['transaction_date'] = transaction_data.transaction_date.isoformat()

        if not transaction_dict.get('transaction_time'):
            transaction_dict['transaction_time'] = datetime.datetime.now().strftime("%H:%M")
        
        doc_ref = db.collection('transactions').add(transaction_dict)
        
        is_income = transaction_data.type == "Income"
        update_account_balance(transaction_data.account_id, transaction_data.amount, is_income, db)
        
        return TransactionDB(id=doc_ref[1].id, **transaction_dict)

    except HTTPException:
        raise 
    except Exception as e:
        print(f"Error creating manual transaction: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create transaction.")


@app.post("/transactions/vlm/extract/{account_id}", response_model=List[TransactionDB])
async def extract_and_save_vlm_transactions(
    account_id: Annotated[str, Path(description="The account ID where extracted transactions will be saved.")],
    file: Annotated[UploadFile, File(description="Bank statement or receipt image/PDF.")],
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db or not storage_bucket:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database or Storage service unavailable")
    
    try:
        check_account_ownership(user_id, account_id, db)
        
        contents = await file.read()
        mime_type = file.content_type

        base64_data = base64.b64encode(contents).decode('utf-8')
        
        vlm_transactions = await extract_transactions_from_data(base64_data, mime_type)
        
        if not vlm_transactions:
            return [] 
        
        saved_transactions: List[TransactionDB] = []
        batch = db.batch()
        
        for vlm_tx in vlm_transactions:
            current_time = datetime.datetime.now().strftime("%H:%M")
            transaction_data = {
                "transaction_date": vlm_tx['date'],
                "transaction_time": current_time,
                "type": vlm_tx['type'],
                "amount": vlm_tx['amount'],
                "category": vlm_tx['category'],
                "merchant": vlm_tx['merchant'],
                "user_id": user_id,
                "account_id": account_id, 
            }
            
            doc_ref = db.collection('transactions').document()
            batch.set(doc_ref, transaction_data)
            
            saved_transactions.append(TransactionDB(id=doc_ref.id, **transaction_data))
            
            is_income = vlm_tx['type'] == "Income"
            update_account_balance(account_id, vlm_tx['amount'], is_income, db)

        batch.commit()
        
        return saved_transactions
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error during VLM transaction extraction/save: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error: {str(e)}")


@app.get("/reports/fhs")
async def get_fhs_report(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")
    
    try:
        transactions_ref = db.collection('transactions').where("user_id", "==", user_id).order_by("transaction_date")
        docs = transactions_ref.stream()
        
        transactions = []
        for doc in docs:
            transaction_data = doc.to_dict()
            if hasattr(transaction_data.get('transaction_date'), 'isoformat'):
                transaction_data['transaction_date'] = transaction_data['transaction_date'].isoformat()
            transactions.append(transaction_data)
        
        if not transactions:
            return {
                "error": "No transactions found for FHS report generation.",
                "message": "Please upload or manually create transactions first."
            }
        
        fhs_report = generate_fhs_report(transactions)
        
        return fhs_report
        
    except ValueError as e:
        print(f"FHS Report generation error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Unexpected error during FHS report generation: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")
    
@app.get("/reports/forecast/lstm")
async def get_lstm_forecast_report(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")
    
    try:
        transactions_ref = db.collection('transactions').where("user_id", "==", user_id).order_by("transaction_date")
        docs = transactions_ref.stream()
        
        transactions = []
        for doc in docs:
            transaction_data = doc.to_dict()
            
            if isinstance(transaction_data.get('transaction_date'), str):
                pass 
            elif hasattr(transaction_data.get('transaction_date'), 'isoformat'):
                transaction_data['transaction_date'] = transaction_data['transaction_date'].isoformat()
            
            transactions.append(transaction_data)
        
        if not transactions:
            return {
                "error": "No transactions found for LSTM forecast generation.",
                "message": "Please upload or manually create transactions first."
            }
        
        
        lstm_report = generate_lstm_forecast(transactions)
        
        if "error" in lstm_report:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=lstm_report["error"])
        
        return lstm_report
        
    except HTTPException:
        raise 
    except ValueError as e:
        print(f"LSTM Forecast error (Value): {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Unexpected error during LSTM report generation: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred during financial forecast.")

async def get_total_current_balance(user_id: str, db: firestore.client) -> float:
    try:
        accounts_ref = db.collection('accounts').where("user_id", "==", user_id)
        docs = accounts_ref.stream()
        total_balance = 0.0
        for doc in docs:
            account_data = doc.to_dict()
            total_balance += account_data.get('current_balance', 0.0)
        return total_balance
    except Exception as e:
        print(f"Error fetching total balance: {e}")
        return 0.0

@app.get("/reports/optimization/rl")
async def get_rl_optimization_report(
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        transactions_ref = db.collection('transactions').where("user_id", "==", user_id).order_by("transaction_date")
        docs = transactions_ref.stream()
        
        transactions = []
        for doc in docs:
            transaction_data = doc.to_dict()
            if hasattr(transaction_data.get('transaction_date'), 'isoformat'):
                transaction_data['transaction_date'] = transaction_data['transaction_date'].isoformat()
            transactions.append(transaction_data)
        
        if len(transactions) < 60: 
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Requires at least 60 days of transaction history for stable RL and LSTM calculations.")
        
        fhs_report = generate_fhs_report(transactions)
        lstm_report = generate_lstm_forecast(transactions)
        
        if "error" in fhs_report or "error" in lstm_report:
            error_detail = fhs_report.get("error") if "error" in fhs_report else lstm_report.get("error")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Financial Analysis Failed: {error_detail}")
            
        latest_fhs_score = fhs_report['summary']['latest_fhs']
        forecast_net_flow = lstm_report['summary']['net_flow_forecast']
        monthly_contribution = max(0.0, forecast_net_flow) 

        starting_balance = await get_total_current_balance(user_id, db)
        
        rl_report = generate_rl_optimization_report(
            latest_fhs=latest_fhs_score, 
            starting_balance=starting_balance, 
            monthly_contribution=monthly_contribution
        )
        
        if "error" in rl_report:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=rl_report["error"])
        
        return rl_report
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error during RL report generation: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred during portfolio optimization.")

async def async_get_fhs_report_internal(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    return generate_fhs_report(transactions)

async def async_get_lstm_forecast_internal(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    return generate_lstm_forecast(transactions)


@app.post("/reports/simulate")
async def simulate_user_question(
    user_question: Annotated[str, Query(description="The user's natural language question for financial simulation.")],
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        transactions_ref = db.collection('transactions').where("user_id", "==", user_id).order_by("transaction_date")
        docs = transactions_ref.stream()
        
        transactions = []
        for doc in docs:
            transaction_data = doc.to_dict()
            if hasattr(transaction_data.get('transaction_date'), 'isoformat'):
                transaction_data['transaction_date'] = transaction_data['transaction_date'].isoformat()
            transactions.append(transaction_data)

        if len(transactions) < 30: 
            print(f"User {user_id} has less than 30 transactions. Switching to General Chat mode.")
            general_response = await generate_general_chat_response(user_question)
            return {
                "simulation_report": general_response,
                "status": "general_chat",
                "note": "Not enough data for full simulation."
            }

        budget_analysis = analyze_recent_transactions(transactions)
        
        simulation_result = await run_simulation(
            user_id=user_id,
            user_question=user_question,
            db=db,
            fhs_report_func=lambda uid: async_get_fhs_report_internal(transactions),
            lstm_report_func=lambda uid: async_get_lstm_forecast_internal(transactions),
            get_balance_func=get_total_current_balance, 
            budget_analysis=budget_analysis 
        )
        
        return simulation_result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Simulation endpoint failed: {e}")
        traceback.print_exc() 
        return {
             "simulation_report": "I encountered a technical issue. Please try again.",
             "error_debug": str(e)
        }
    
@app.get("/reports/recurring")
async def get_recurring_payments(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    recurring_report = await get_recurring_report(user_id, db)
    
    if "error" in recurring_report:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=recurring_report["error"])
        
    return recurring_report

@app.get("/reports/budget/auto")
async def generate_one_tap_budget(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        transactions_ref = db.collection('transactions').where("user_id", "==", user_id).order_by("transaction_date")
        docs = transactions_ref.stream()
        
        transactions = []
        for doc in docs:
            transaction_data = doc.to_dict()
            if hasattr(transaction_data.get('transaction_date'), 'isoformat'):
                transaction_data['transaction_date'] = transaction_data['transaction_date'].isoformat()
            transactions.append(transaction_data)
        
        if len(transactions) < 90: 
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                                detail="Requires at least 90 days of transaction history to generate a smart budget.")
        
        fhs_report = generate_fhs_report(transactions)
        lstm_report = generate_lstm_forecast(transactions)
        
        if "error" in fhs_report or "error" in lstm_report:
            error_detail = fhs_report.get("error") or lstm_report.get("error")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                                detail=f"Financial Analysis Failed: {error_detail}")
        
        budget_report = await generate_auto_budget(
            user_id=user_id,
            db=db,
            fhs_report=fhs_report,
            lstm_report=lstm_report
        )
        
        if "error" in budget_report:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=budget_report["error"])
            
        return budget_report
        
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Unexpected error during Auto-Budget generation: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred during budget generation.")
    
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    current_dir = Path(__file__).resolve().parent
    favicon_path = current_dir.parent / "FinanceAssistantUI" / "assets" / "favicon.png"
    
    if favicon_path.exists():
        return FileResponse(favicon_path)
    else:
        return {"status": "No favicon found"}
    

@app.get("/transactions/", response_model=List[TransactionDB])
async def get_transactions(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """
    Get all transactions for the current user.
    """
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
        
    try:
        transactions_ref = db.collection('transactions') \
            .where("user_id", "==", user_id) \
            .order_by("transaction_date", direction=firestore.Query.DESCENDING)
            
        docs = transactions_ref.stream()
        
        transactions = []
        for doc in docs:
            data = doc.to_dict()
            transactions.append(TransactionDB(id=doc.id, **data))
            
        return transactions
    except Exception as e:
        print(f"Error fetching transactions: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

        
@app.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """Deletes a transaction by its ID and updates the account balance."""
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")

    try:
        doc_ref = db.collection('transactions').document(transaction_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
            
        transaction_data = doc.to_dict()
        
        if transaction_data.get('user_id') != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
            
        is_income = transaction_data.get('type') == 'Income'
        account_id = transaction_data.get('account_id')
        
        if account_id:
            update_account_balance(account_id, transaction_data.get('amount', 0), not is_income, db)
            
        doc_ref.delete()
        
        return
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting transaction: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.put("/transactions/{transaction_id}", response_model=TransactionDB)
async def update_transaction(
    transaction_id: str,
    transaction_update: Transaction, 
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """Updates a transaction and adjusts account balance."""
    db = get_db()
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
        
    try:
        doc_ref = db.collection('transactions').document(transaction_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
            
        old_data = doc.to_dict()
        
        if old_data.get('user_id') != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
            
        old_is_income = old_data.get('type') == 'Income'
        old_account_id = old_data.get('account_id')
        old_amount = old_data.get('amount', 0)
        
        if old_account_id:
             update_account_balance(old_account_id, old_amount, not old_is_income, db)
             
        new_data = transaction_update.model_dump()
        new_data['user_id'] = user_id
        new_data['transaction_date'] = transaction_update.transaction_date.isoformat()
        
        if not new_data.get('transaction_time'):
             new_data['transaction_time'] = old_data.get('transaction_time', "00:00")
             
        doc_ref.set(new_data)
        
        new_is_income = transaction_update.type == 'Income'
        new_account_id = transaction_update.account_id
        new_amount = transaction_update.amount
        
        if new_account_id:
            update_account_balance(new_account_id, new_amount, new_is_income, db)
            
        return TransactionDB(id=transaction_id, **new_data)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating transaction: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))