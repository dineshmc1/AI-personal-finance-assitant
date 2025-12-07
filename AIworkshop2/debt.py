# AI workshop 2/debt.py 
import firebase_admin
from firebase_admin import firestore
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Annotated, Dict, Any, Literal
from pydantic import BaseModel, Field
from auth_deps import get_current_user_id 
from datetime import date
import math
import logging
from models import DebtCreate, DebtDB, RepaymentPlanSummary, DebtReport

logging.basicConfig(level=logging.INFO)

debt_router = APIRouter(
    prefix="/debt",
    tags=["Debt Manager"],
)

def get_db():
    try:
        return firestore.client()
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

class DebtCreate(BaseModel):
    """Schema for creating a new debt entry."""
    name: str = Field(description="E.g., Car Loan, Visa Card, PTPTN.")
    initial_principal: float = Field(gt=0, description="The initial amount of the debt.")
    current_principal: float = Field(gt=0, description="The current remaining balance.")
    interest_rate_annual: float = Field(ge=0, description="Annual interest rate (e.g., 5.5 for 5.5%).")
    minimum_monthly_payment: float = Field(gt=0, description="The required minimum payment per month.")
    
class DebtDB(DebtCreate):
    """Schema for a debt entry as stored in the database."""
    id: str
    user_id: str

class RepaymentPlanSummary(BaseModel):
    """Summary of a single repayment plan (Snowball or Avalanche)."""
    method: str
    time_to_debt_free_months: int
    total_interest_paid: float = Field(description="Total interest paid until all debts are clear.")
    monthly_payment_required: float = Field(description="The initial total minimum payment required.")
    
class DebtReport(BaseModel):
    """The full report comparing the two methods and providing recommendations."""
    base_plans: List[RepaymentPlanSummary]
    recommendation: Dict[str, Any]
    analysis_date: date = Field(default_factory=date.today)


def calculate_repayment(
    debts: List[Dict[str, Any]], 
    method: Literal["Snowball", "Avalanche"],
    extra_monthly_payment: float = 0.0
) -> RepaymentPlanSummary:
    """
    Simulates debt repayment using the specified method (Snowball or Avalanche).
    Returns total interest paid and months to debt-free.
    """
    if not debts:
        return RepaymentPlanSummary(
            method=method, 
            time_to_debt_free_months=0, 
            total_interest_paid=0.0, 
            monthly_payment_required=0.0
        )
    
    sim_debts = []
    total_min_payment = 0.0
    for debt in debts:
        sim_debts.append({
            'name': debt['name'],
            'principal': debt['current_principal'],
            'rate_monthly': (debt['interest_rate_annual'] / 100) / 12,
            'min_payment': debt['minimum_monthly_payment'],
            'paid_off': False
        })
        total_min_payment += debt['minimum_monthly_payment']

    if method == "Snowball":
        sim_debts.sort(key=lambda d: d['principal'])
    elif method == "Avalanche":
        sim_debts.sort(key=lambda d: d['rate_monthly'], reverse=True)

    months = 0
    total_interest_paid = 0.0
    
    
    rollover_payment = extra_monthly_payment
    
    while any(d['principal'] > 0 for d in sim_debts) and months < 1200:
        months += 1
        
        current_rollover = 0.0
        
        for i, debt in enumerate(sim_debts):
            if debt['paid_off']:
                continue

            interest_paid = debt['principal'] * debt['rate_monthly']
            total_interest_paid += interest_paid
            
            payment = debt['min_payment']
            
            if i == 0 or sim_debts[i-1]['paid_off']: 
                payment += rollover_payment 
            
            payment = max(payment, debt['min_payment'])
            
            payment = min(payment, debt['principal'] + interest_paid)

            principal_paid = payment - interest_paid
            debt['principal'] -= principal_paid
            
            if debt['principal'] <= 0.01: 
                
                remaining_payment = abs(debt['principal']) 
                
                rollover_payment += debt['min_payment'] + remaining_payment
                
                debt['principal'] = 0.0
                debt['paid_off'] = True
                
                
                if method == "Snowball":
                    sim_debts.sort(key=lambda d: (d['paid_off'], d['principal']))
                elif method == "Avalanche":
                    sim_debts.sort(key=lambda d: (d['paid_off'], -d['rate_monthly'])) 
                    
        if all(d['paid_off'] for d in sim_debts):
            break

    return RepaymentPlanSummary(
        method=method,
        time_to_debt_free_months=months,
        total_interest_paid=round(total_interest_paid, 2),
        monthly_payment_required=round(total_min_payment, 2)
    )


@debt_router.post("/", response_model=DebtDB, status_code=status.HTTP_201_CREATED)
async def create_debt(
    debt_data: DebtCreate,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """Creates a new debt entry for the authenticated user."""
    db = get_db() 
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        debt_dict = debt_data.model_dump()
        debt_dict['user_id'] = user_id

        _, doc_ref = db.collection('debts').add(debt_dict) 
        return DebtDB(id=doc_ref.id, **debt_dict)

    except Exception as e:
        logging.error(f"Error creating debt: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create debt.")

@debt_router.get("/", response_model=List[DebtDB])
async def list_debts(
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """Retrieves all debts for the authenticated user."""
    db = get_db() 
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        debts_ref = db.collection('debts').where("user_id", "==", user_id)
        docs = debts_ref.stream()
        
        debts: List[DebtDB] = []
        for doc in docs:
            debt_data = doc.to_dict()
            debts.append(DebtDB(id=doc.id, **debt_data))
            
        return debts
        
    except Exception as e:
        logging.error(f"Error listing debts: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve debts.")


@debt_router.get("/reports/optimization", response_model=DebtReport)
async def get_debt_optimization_report(
    user_id: Annotated[str, Depends(get_current_user_id)],
    extra_payment_amount: Annotated[float, Field(default=100.0, ge=0.0, description="The extra amount to apply monthly to the prioritized debt.")] = 100.0
):
    """
    Generates a full debt optimization report, comparing Snowball vs. Avalanche 
    methods, including the impact of an extra monthly payment.
    """
    db = get_db() 
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    debts: List[Dict[str, Any]] = []
    try:
        debts_ref = db.collection('debts').where("user_id", "==", user_id)
        docs = debts_ref.stream()
        for doc in docs:
            debts.append(doc.to_dict())
            
        if not debts:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No debts found for the user. Please add debts first.")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching debts: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch debts.")

    
    
    snowball_base = calculate_repayment(debts, "Snowball", extra_monthly_payment=0.0)
    avalanche_base = calculate_repayment(debts, "Avalanche", extra_monthly_payment=0.0)
    
    snowball_extra = calculate_repayment(debts, "Snowball", extra_monthly_payment=extra_payment_amount)
    avalanche_extra = calculate_repayment(debts, "Avalanche", extra_monthly_payment=extra_payment_amount)

    
    recommended_plan = avalanche_extra
    
    if avalanche_extra.total_interest_paid < snowball_extra.total_interest_paid:
        best_method = "Avalanche"
    elif avalanche_extra.total_interest_paid > snowball_extra.total_interest_paid:
        best_method = "Snowball"
    else:
        best_method = "Avalanche (tie on interest, slightly faster on time)"
        
    base_plan = avalanche_base if best_method == "Avalanche" else snowball_base
    time_saved_months = base_plan.time_to_debt_free_months - recommended_plan.time_to_debt_free_months
    
    interest_saved = base_plan.total_interest_paid - recommended_plan.total_interest_paid
    
    recommendation = {
        "best_strategy": best_method,
        "extra_payment_amount": extra_payment_amount,
        "time_saved_months": time_saved_months,
        "interest_saved": round(interest_saved, 2),
        "summary_message": (
            f"By using the **{best_method}** method and paying an extra RM{extra_payment_amount:.2f} per month, "
            f"you can become debt-free **{time_saved_months} months** faster and save a total of "
            f"RM{interest_saved:.2f} in interest compared to paying minimum only."
        ),
        "total_monthly_payment": round(recommended_plan.monthly_payment_required + extra_payment_amount, 2)
    }

    return DebtReport(
        base_plans=[snowball_extra, avalanche_extra],
        recommendation=recommendation
    )