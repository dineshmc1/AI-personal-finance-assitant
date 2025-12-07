# AI workshop 2/goals.py
import firebase_admin
from firebase_admin import firestore
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Annotated
from pydantic import BaseModel
from models import GoalCreate, GoalDB, GoalCalculated, BudgetCreate, BudgetDB, BudgetCalculated
from auth_deps import get_current_user_id
from datetime import date, timedelta
import math
from google.cloud.firestore import FieldFilter
from accounts import update_account_balance
from models import TransactionDB
from datetime import datetime

goals_router = APIRouter(
    prefix="/goals",
    tags=["Goals & Budgets"],
)

class GoalProgressUpdate(BaseModel):
    amount_change: float 

def get_db():
    try:
        return firestore.client()
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def get_user_default_account_id(user_id: str, db) -> str:
    """
    Helper to find the first account for a user to refund money to.
    If no account exists, returns None.
    """
    accounts_ref = db.collection('accounts').where("user_id", "==", user_id).limit(1)
    docs = accounts_ref.stream()
    for doc in docs:
        return doc.id
    return None

def get_calculation_dates(period: str = "Monthly") -> tuple[date, date, int]:
    """Returns today, start of period, and days remaining."""
    today = date.today()
    
    if period == "Weekly":
        start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=6)
    else:
        start_date = date(today.year, today.month, 1)
        if today.month == 12:
            end_date = date(today.year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(today.year, today.month + 1, 1) - timedelta(days=1)
            
    days_remaining = (end_date - today).days + 1
    return today, start_date, days_remaining

def calculate_goal_metrics(goal: GoalDB) -> GoalCalculated:
    today = date.today()
    if goal.target_date <= today:
        days_remaining = 0
    else:
        days_remaining = (goal.target_date - today).days
    amount_to_save = goal.target_amount - goal.current_saved
    if amount_to_save <= 0 or days_remaining <= 0:
        daily_required = 0.0
    else:
        daily_required = amount_to_save / days_remaining
    return GoalCalculated(
        id=goal.id,
        user_id=goal.user_id,
        name=goal.name,
        target_amount=goal.target_amount,
        target_date=goal.target_date,
        current_saved=goal.current_saved,
        days_remaining=days_remaining,
        amount_to_save=max(0.0, amount_to_save),
        daily_investment_required=round(daily_required, 2),
        weekly_investment_required=round(daily_required * 7, 2),
        monthly_investment_required=round(daily_required * (365.25 / 12), 2)
    )

def calculate_budget_metrics(budget: BudgetDB, user_id: str, db) -> BudgetCalculated:
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    today, start_date, days_remaining = get_calculation_dates(budget.period)

    transactions_ref = (db.collection('transactions')
                    .where(filter=FieldFilter("user_id", "==", user_id))
                    .where(filter=FieldFilter("category", "==", budget.category))
                    .where(filter=FieldFilter("type", "==", "Expense"))
                    .where(filter=FieldFilter("transaction_date", ">=", start_date.isoformat()))
                    .where(filter=FieldFilter("transaction_date", "<=", today.isoformat())))
    docs = transactions_ref.stream()
    
    current_spending = 0.0
    for doc in docs:
        transaction = doc.to_dict()
        current_spending += transaction.get('amount', 0.0)

    remaining_budget = budget.limit_amount - current_spending
    
    if remaining_budget <= 0:
        daily_limit = 0.0
    elif days_remaining <= 0:
        daily_limit = remaining_budget 
    else:
        daily_limit = remaining_budget / days_remaining

    return BudgetCalculated(
        id=budget.id,
        user_id=budget.user_id,
        name=budget.name,
        category=budget.category,
        limit_amount=budget.limit_amount,
        period=budget.period,
        current_spending=round(current_spending, 2),
        remaining_budget=round(remaining_budget, 2),
        days_remaining=days_remaining,
        daily_spending_limit=round(daily_limit, 2)
    )

@goals_router.post("/goal", response_model=GoalDB, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_data: GoalCreate,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    if goal_data.target_date <= date.today():
        raise HTTPException(status_code=400, detail="Target date must be in the future.")
    try:
        goal_dict = goal_data.model_dump()
        goal_dict['user_id'] = user_id
        goal_dict['target_date'] = goal_data.target_date.isoformat() 
        doc_ref = db.collection('goals').add(goal_dict)
        return GoalDB(id=doc_ref[1].id, **goal_dict)
    except Exception as e:
        print(f"Error creating goal: {e}")
        raise HTTPException(status_code=500, detail="Failed to create goal.")

@goals_router.get("/goal", response_model=List[GoalCalculated])
async def list_goals(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        goals_ref = db.collection('goals').where("user_id", "==", user_id)
        docs = goals_ref.stream()
        calculated_goals = []
        for doc in docs:
            goal_data = doc.to_dict()
            goal_data['target_date'] = date.fromisoformat(goal_data['target_date'])
            goal_db = GoalDB(id=doc.id, **goal_data)
            calculated_goals.append(calculate_goal_metrics(goal_db))
        return calculated_goals
    except Exception as e:
        print(f"Error listing goals: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve goals.")

@goals_router.put("/goal/{goal_id}/progress")
async def update_goal_progress(
    goal_id: str,
    update_data: GoalProgressUpdate,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        goal_ref = db.collection('goals').document(goal_id)
        goal_doc = goal_ref.get()
        if not goal_doc.exists: raise HTTPException(status_code=404, detail="Goal not found")
        if goal_doc.to_dict().get('user_id') != user_id: raise HTTPException(status_code=403, detail="Not authorized")
            
        current_saved = goal_doc.to_dict().get('current_saved', 0.0)
        new_saved = current_saved + update_data.amount_change
        if new_saved < 0: new_saved = 0.0
        goal_ref.update({'current_saved': new_saved})
        return {"message": "Progress updated", "new_saved": new_saved}
    except HTTPException: raise
    except Exception as e:
        print(f"Error updating goal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@goals_router.delete("/goal/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """Deletes a financial goal and refunds the saved amount to default account."""
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        goal_ref = db.collection('goals').document(goal_id)
        goal_doc = goal_ref.get()
        
        if not goal_doc.exists:
            raise HTTPException(status_code=404, detail="Goal not found")
            
        goal_data = goal_doc.to_dict()
        if goal_data.get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        amount_to_refund = goal_data.get('current_saved', 0.0)
        goal_name = goal_data.get('name', 'Unknown Goal')
        
        if amount_to_refund > 0:
            default_account_id = get_user_default_account_id(user_id, db)
            if default_account_id:
                update_account_balance(default_account_id, amount_to_refund, True, db)
                
                refund_transaction = {
                    "user_id": user_id,
                    "account_id": default_account_id,
                    "type": "Income",
                    "amount": amount_to_refund,
                    "category": "Savings", 
                    "merchant": f"Refund: {goal_name}",
                    "transaction_date": date.today().isoformat(),
                    "transaction_time": datetime.now().strftime("%H:%M")
                }
                db.collection('transactions').add(refund_transaction)
        
        goal_ref.delete()
        return
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting goal: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete goal.")

@goals_router.post("/budget", response_model=BudgetDB, status_code=status.HTTP_201_CREATED)
async def create_budget(budget_data: BudgetCreate, user_id: Annotated[str, Depends(get_current_user_id)]):
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        budget_dict = budget_data.model_dump()
        budget_dict['user_id'] = user_id
        doc_ref = db.collection('budgets').add(budget_dict)
        return BudgetDB(id=doc_ref[1].id, **budget_dict)
    except Exception as e:
        print(f"Error creating budget: {e}")
        raise HTTPException(status_code=500, detail="Failed to create budget.")

@goals_router.get("/budget", response_model=List[BudgetCalculated])
async def list_budgets(user_id: Annotated[str, Depends(get_current_user_id)]):
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        budgets_ref = db.collection('budgets').where("user_id", "==", user_id)
        docs = budgets_ref.stream()
        calculated_budgets = []
        for doc in docs:
            budget_data = doc.to_dict()
            budget_db = BudgetDB(id=doc.id, **budget_data)
            calculated_budgets.append(calculate_budget_metrics(budget_db, user_id, db))
        return calculated_budgets
    except Exception as e:
        print(f"Error listing budgets: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve budgets.")
    

@goals_router.delete("/budget/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """Deletes a budget."""
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        budget_ref = db.collection('budgets').document(budget_id)
        budget_doc = budget_ref.get()
        
        if not budget_doc.exists:
            raise HTTPException(status_code=404, detail="Budget not found")
            
        if budget_doc.to_dict().get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        budget_ref.delete()
        return
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting budget: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete budget.")
    
@goals_router.put("/budget/{budget_id}")
async def update_budget(
    budget_id: str,
    budget_data: BudgetCreate,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    db = get_db()
    if not db: raise HTTPException(status_code=503, detail="Database unavailable")
    
    try:
        budget_ref = db.collection('budgets').document(budget_id)
        budget_doc = budget_ref.get()
        
        if not budget_doc.exists:
            raise HTTPException(status_code=404, detail="Budget not found")
            
        if budget_doc.to_dict().get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        update_payload = {
            "limit_amount": budget_data.limit_amount,
            "period": budget_data.period,
            "name": f"{budget_data.category} Budget" 
        }
        
        budget_ref.update(update_payload)
        return {"message": "Budget updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating budget: {e}")
        raise HTTPException(status_code=500, detail="Failed to update budget.")