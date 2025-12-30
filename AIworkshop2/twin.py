# AI workshop 2/twin.py
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Annotated, List, Dict, Any
from firebase_admin import firestore
from datetime import date, datetime
import uuid
from google.cloud.firestore import FieldFilter 

from auth_deps import get_current_user_id
from models import (
    GamificationProfile, 
    Badge, 
    TwinDashboard, 
    TwinScenario
)

twin_router = APIRouter(prefix="/twin", tags=["Digital Twin & Gamification"])

LEVEL_XP_BASE = 1000
XP_PER_TRANSACTION = 10
XP_BEAT_EASY = 100
XP_BEAT_MEDIUM = 300
XP_BEAT_HARD = 600

def get_db():
    try:
        return firestore.client()
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def calculate_level(xp: int) -> tuple[int, int]:
    """Returns (current_level, xp_needed_for_next_level)"""
    level = (xp // LEVEL_XP_BASE) + 1
    next_level_xp = level * LEVEL_XP_BASE
    return level, next_level_xp

def get_or_create_profile(user_id: str, db) -> GamificationProfile:
    """Fetches user gamification profile or creates a default one."""
    doc_ref = db.collection('gamification').document(user_id)
    doc = doc_ref.get()
    
    if doc.exists:
        data = doc.to_dict()
        badges = [Badge(**b) for b in data.get('badges', [])]
        return GamificationProfile(
            user_id=user_id,
            level=data.get('level', 1),
            current_xp=data.get('current_xp', 0),
            xp_to_next_level=data.get('xp_to_next_level', 1000),
            total_battles_won=data.get('total_battles_won', 0),
            badges=badges,
            last_claimed_month=data.get('last_claimed_month') 
        )
    else:
        new_profile = GamificationProfile(user_id=user_id)
        doc_ref.set(new_profile.model_dump())
        return new_profile

def update_xp(user_id: str, amount: int, db):
    """Adds XP and updates level."""
    profile = get_or_create_profile(user_id, db)
    profile.current_xp += amount
    
    new_level, next_xp = calculate_level(profile.current_xp)
    
    profile.level = new_level
    profile.xp_to_next_level = next_xp
    
    db.collection('gamification').document(user_id).set(profile.model_dump())
    return profile

def generate_twin_logic(user_income: float, user_expenses: float, transactions: List[Dict]) -> Dict[str, TwinScenario]:
    """
    Generates the 3 levels of Digital Twins based on user data.
    Hierarchy: Easy < Medium < Hard savings goals.
    """
    needs_categories = ["Housing", "Transportation", "Vehicle", "Financial Expenses", "Income"]
    wants_categories = ["Food", "Shopping", "Entertainment", "Other"]
    
    user_needs = 0.0
    user_wants = 0.0
    
    for t in transactions:
        if t['type'] == "Expense":
            cat = t.get('category', 'Other')
            if cat in needs_categories:
                user_needs += t['amount']
            else:
                user_wants += t['amount']

    user_balance = user_income - user_expenses
    user_savings_rate = (user_balance / user_income * 100) if user_income > 0 else 0
    
    # 1. Easy Twin: 20% Savings, 80% Spending
    easy_savings_rate = 20.0
    easy_expense_target = user_income * 0.80
    easy_balance = user_income - easy_expense_target
    
    easy_twin = TwinScenario(
        difficulty="Easy Twin",
        income=user_income,
        expenses=easy_expense_target,
        balance=easy_balance,
        savings_rate=easy_savings_rate,
        description="A relaxed goal: 20% Savings, 80% Spending.",
        needs=easy_expense_target * 0.625, # 50% of total income if 80% is spent
        wants=easy_expense_target * 0.375, # 30% of total income if 80% is spent
        savings=easy_balance,
        potential_xp=XP_BEAT_EASY
    )

    # 2. Medium Twin: 50% Savings, 50% Spending
    med_savings_rate = 50.0
    med_expense_target = user_income * 0.50
    med_balance = user_income - med_expense_target
    
    medium_twin = TwinScenario(
        difficulty="Medium Twin",
        income=user_income,
        expenses=med_expense_target,
        balance=med_balance,
        savings_rate=med_savings_rate,
        description="A balanced goal: 50% Savings, 50% Spending.",
        needs=med_expense_target * 0.625, 
        wants=med_expense_target * 0.375,
        savings=med_balance,
        potential_xp=XP_BEAT_MEDIUM
    )

    # 3. Hard Twin: 70% Savings, 30% Spending
    hard_savings_rate = 70.0
    hard_expense_target = user_income * 0.30
    hard_balance = user_income - hard_expense_target
    
    hard_twin = TwinScenario(
        difficulty="Hard Twin",
        income=user_income, 
        expenses=hard_expense_target,
        balance=hard_balance,
        savings_rate=hard_savings_rate,
        description="An aggressive goal: 70% Savings, 30% Spending.",
        needs=hard_expense_target * 0.625, 
        wants=hard_expense_target * 0.375,
        savings=hard_balance,
        potential_xp=XP_BEAT_HARD
    )
    
    user_scenario = TwinScenario(
        difficulty="User (You)",
        income=user_income,
        expenses=user_expenses,
        balance=user_balance,
        savings_rate=user_savings_rate,
        description="Your actual financial performance this month.",
        needs=user_needs,
        wants=user_wants,
        savings=user_balance,
        potential_xp=0
    )
    
    return {
        "user": user_scenario,
        "easy": easy_twin,
        "medium": medium_twin,
        "hard": hard_twin
    }


@twin_router.get("/dashboard", response_model=TwinDashboard)
async def get_twin_dashboard(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """
    Get the gamified dashboard comparing User vs Twins for the current month.
    """
    db = get_db() 
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")
    
    today = date.today()
    start_date = date(today.year, today.month, 1).isoformat()
    
    transactions_ref = db.collection('transactions')\
        .where(filter=FieldFilter("user_id", "==", user_id))\
        .where(filter=FieldFilter("transaction_date", ">=", start_date))
        
    docs = transactions_ref.stream()
    
    transactions = []
    total_income = 0.0
    total_expenses = 0.0
    
    for doc in docs:
        t = doc.to_dict()
        transactions.append(t)
        if t['type'] == 'Income':
            total_income += t['amount']
        else:
            total_expenses += t['amount']
            
    scenarios = generate_twin_logic(total_income, total_expenses, transactions)
    
    profile = get_or_create_profile(user_id, db)
    
    user_bal = scenarios['user'].balance
    status_msg = "Keep pushing! The twins are winning."
    
    if user_bal > scenarios['hard'].balance:
        status_msg = "UNSTOPPABLE! You are beating the Hard Twin! 🏆"
    elif user_bal > scenarios['medium'].balance:
        status_msg = "Great job! You're beating the Medium Twin. Next stop: Hard."
    elif user_bal > scenarios['easy'].balance:
        status_msg = "Good start! You're beating the Easy Twin."
        
    est_xp = 0
    if scenarios['user'].balance > scenarios['easy'].balance:
        est_xp += XP_BEAT_EASY
    if scenarios['user'].balance > scenarios['medium'].balance:
        est_xp += XP_BEAT_MEDIUM
    if scenarios['user'].balance > scenarios['hard'].balance:
        est_xp += XP_BEAT_HARD

    return TwinDashboard(
        user_stats=scenarios['user'],
        easy_twin=scenarios['easy'],
        medium_twin=scenarios['medium'],
        hard_twin=scenarios['hard'],
        gamification_profile=profile,
        battle_status=status_msg,
        estimated_xp=est_xp
    )

@twin_router.post("/claim-xp")
async def claim_monthly_xp(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """
    Call this at the end of the month (or manually) to claim XP based on performance.
    Prevents claiming multiple times per month and claiming too early.
    """
    db = get_db() 
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")
    
    today = date.today()
    current_month_str = today.strftime("%Y-%m")
    
    if today.day < 25:
        raise HTTPException(status_code=400, detail="It's too early! Come back after the 25th to claim your monthly rewards.")

    profile = get_or_create_profile(user_id, db)

    if profile.last_claimed_month == current_month_str:
        raise HTTPException(status_code=400, detail="You have already claimed XP for this month!")
    
    start_date = date(today.year, today.month, 1).isoformat()
    
    transactions_ref = db.collection('transactions')\
        .where(filter=FieldFilter("user_id", "==", user_id))\
        .where(filter=FieldFilter("transaction_date", ">=", start_date))
    docs = transactions_ref.stream()
    
    total_income = 0.0
    total_expenses = 0.0
    tx_list = []
    for doc in docs:
        t = doc.to_dict()
        tx_list.append(t)
        if t['type'] == 'Income':
            total_income += t['amount']
        else:
            total_expenses += t['amount']

    scenarios = generate_twin_logic(total_income, total_expenses, tx_list)
    
    user_bal = scenarios['user'].balance
    xp_gained = 0
    badges_earned = []
    
    if user_bal > scenarios['easy'].balance:
        xp_gained += XP_BEAT_EASY
    if user_bal > scenarios['medium'].balance:
        xp_gained += XP_BEAT_MEDIUM
    if user_bal > scenarios['hard'].balance:
        xp_gained += XP_BEAT_HARD
        badges_earned.append(Badge(
            id=str(uuid.uuid4()),
            name="Twin Slayer",
            description="Beat the Hard Twin in a monthly battle.",
            icon="🤖",
            date_earned=date.today()
        ))

    if xp_gained == 0:
        return {"message": "Keep trying! No XP gained this time.", "xp_gained": 0}

    profile.current_xp += xp_gained
    profile.total_battles_won += 1
    profile.badges.extend(badges_earned)
    
    profile.last_claimed_month = current_month_str 
    
    new_level, next_xp = calculate_level(profile.current_xp)
    profile.level = new_level
    profile.xp_to_next_level = next_xp
    
    db.collection('gamification').document(user_id).set(profile.model_dump())
    
    return {
        "message": f"Victory! You gained {xp_gained} XP.",
        "new_level": new_level,
        "badges_earned": [b.name for b in badges_earned]
    }