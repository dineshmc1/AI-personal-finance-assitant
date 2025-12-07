# AI workshop 2/models.py 
from pydantic import BaseModel, Field
from datetime import date
from typing import Literal, Optional, List, Dict, Any

TransactionType = Literal["Income", "Expense"]

TransactionCategory = str 

BillFrequency = Literal["Monthly", "Bi-Weekly", "Quarterly", "Annually"]

BudgetPeriod = Literal["Monthly", "Weekly"]

# === Category ===
class CategoryCreate(BaseModel):
    name: str = Field(..., description="Name of the category")
    type: TransactionType = Field(..., description="Income or Expense")
    icon: str = Field("tag", description="Icon name")
    color: str = Field("#808080", description="Hex color")
    is_default: bool = Field(False, description="Is this a system default category?")

class CategoryDB(CategoryCreate):
    id: str
    user_id: str

    class Config:
        from_attributes = True

# === Account ===
class AccountBase(BaseModel):
    name: str = Field(..., description="User-defined name for the account")
    current_balance: float = Field(0.0, description="The current balance")

class AccountCreate(AccountBase):
    pass 

class AccountDB(AccountBase):
    id: Optional[str] = Field(None, description="Firestore ID")
    user_id: str = Field(..., description="Firebase User ID")
    class Config:
        from_attributes = True

# === Transaction ===
class TransactionBase(BaseModel):
    transaction_date: date = Field(..., description="Date (YYYY-MM-DD)")
    type: TransactionType = Field(..., description="'Income' or 'Expense'")
    amount: float = Field(..., gt=0, description="Amount > 0")
    category: TransactionCategory = Field(..., description="Category name")
    merchant: str = Field(..., description="Merchant name")
    account_id: str = Field(..., description="Account ID")
    transaction_time: Optional[str] = Field(None, description="Time (HH:MM)") 

class TransactionDB(TransactionBase):
    user_id: str = Field(..., description="Firebase User ID")
    id: Optional[str] = Field(None, description="Firestore ID")
    class Config:
        from_attributes = True
    
Transaction = TransactionBase

# === Goal ===
class GoalCreate(BaseModel):
    name: str = Field(..., description="Goal name")
    target_amount: float = Field(..., gt=0)
    target_date: date = Field(..., description="Target date")
    current_saved: float = Field(0.0, ge=0)

class GoalDB(GoalCreate):
    id: Optional[str] = Field(None, description="Firestore ID")
    user_id: str = Field(..., description="Owner user id")
    class Config:
        from_attributes = True

class GoalCalculated(BaseModel):
    id: Optional[str]
    user_id: str
    name: str
    target_amount: float
    target_date: date
    current_saved: float
    days_remaining: int
    amount_to_save: float
    daily_investment_required: float
    weekly_investment_required: float
    monthly_investment_required: float

# === Budget ===
class BudgetCreate(BaseModel):
    name: str = Field(..., description="Budget name")
    category: TransactionCategory = Field(..., description="Spending category")
    limit_amount: float = Field(..., gt=0, description="Spending limit for the period") 
    period: BudgetPeriod = Field("Monthly", description="Budget cycle")

class BudgetDB(BudgetCreate):
    id: Optional[str] = Field(None, description="Firestore ID")
    user_id: str = Field(..., description="Owner user id")
    class Config:
        from_attributes = True

class BudgetCalculated(BaseModel):
    id: Optional[str]
    user_id: str
    name: str
    category: TransactionCategory
    limit_amount: float 
    period: BudgetPeriod 

    current_spending: float
    remaining_budget: float
    days_remaining: int
    daily_spending_limit: float

# === Bill  ===
class BillCreate(BaseModel):
    name: str
    amount: float = Field(..., gt=0)
    next_due_date: date
    frequency: BillFrequency
    category: TransactionCategory = Field("Housing")

class BillDB(BillCreate):
    id: Optional[str]
    user_id: str
    class Config:
        from_attributes = True

# === Calendar  ===
class CalendarEvent(BaseModel):
    id: Optional[str] = None 
    event_date: date
    type: Literal["Bill Due", "Income Expected", "Budget Reset", "User Bill"]
    name: str
    amount: Optional[float]
    source: Optional[str]

# === Debt  ===
class DebtCreate(BaseModel):
    name: str
    initial_principal: float = Field(gt=0)
    current_principal: float = Field(gt=0)
    interest_rate_annual: float = Field(ge=0)
    minimum_monthly_payment: float = Field(gt=0)
    
class DebtDB(DebtCreate):
    id: Optional[str]
    user_id: str
    class Config:
        from_attributes = True

class RepaymentPlanSummary(BaseModel):
    method: Literal["Snowball", "Avalanche"]
    time_to_debt_free_months: int
    total_interest_paid: float
    monthly_payment_required: float
    
class DebtReport(BaseModel):
    base_plans: List[RepaymentPlanSummary]
    recommendation: Dict[str, Any]
    analysis_date: date = Field(default_factory=date.today)

# === Twin & Gamification  ===
class Badge(BaseModel):
    id: str
    name: str
    description: str
    icon: str 
    date_earned: date

class GamificationProfile(BaseModel):
    user_id: str
    level: int = Field(1)
    current_xp: int = Field(0)
    xp_to_next_level: int = Field(1000)
    total_battles_won: int = Field(0)
    badges: List[Badge] = []
    last_claimed_month: Optional[str] = None

class TwinScenario(BaseModel):
    difficulty: Literal["User (You)", "Easy Twin", "Medium Twin", "Hard Twin"]
    income: float
    expenses: float
    balance: float
    savings_rate: float
    description: str
    needs: float
    wants: float
    savings: float

class TwinDashboard(BaseModel):
    user_stats: TwinScenario
    easy_twin: TwinScenario
    medium_twin: TwinScenario
    hard_twin: TwinScenario
    gamification_profile: GamificationProfile
    battle_status: str

class UserSignup(BaseModel):
    email: str
    password: str
    username: str