# AI workshop 2/calender.py
from firebase_admin import firestore
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Annotated, Dict, Any, Optional
from models import BillCreate, BillDB, CalendarEvent, TransactionCategory
from auth_deps import get_current_user_id
from datetime import date, timedelta
import math
import logging
from subscription import get_recurring_report 
from goals import get_calculation_dates 
from collections import defaultdict 

logging.basicConfig(level=logging.INFO)

# === 移除顶层 db 初始化 ===
# try:
#     db = firestore.client()
# except ValueError:
#     db = None

calendar_router = APIRouter(
    prefix="/calendar",
    tags=["Cash Flow Calendar"],
)

# === 新增：获取 DB 的辅助函数 ===
def get_db():
    try:
        return firestore.client()
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def get_next_date(current_date: date, frequency: str) -> Optional[date]:
    """Calculates the next due date based on the current date and frequency."""
    if frequency == "Monthly":
        next_month = current_date.month % 12 + 1
        next_year = current_date.year + (current_date.month // 12)
        try:
            return date(next_year, next_month, current_date.day)
        except ValueError:
            return date(next_year, next_month + 1, 1) - timedelta(days=1)
            
    elif frequency == "Bi-Weekly":
        return current_date + timedelta(days=14)
    elif frequency == "Quarterly":
        return current_date + timedelta(days=91)
    elif frequency == "Annually":
        return date(current_date.year + 1, current_date.month, current_date.day)
    
    return None


@calendar_router.post("/bill", response_model=BillDB, status_code=status.HTTP_201_CREATED)
async def create_bill(
    bill_data: BillCreate,
    user_id: Annotated[str, Depends(get_current_user_id)]
):
    """Creates a new user-defined recurring bill payment."""
    db = get_db() # 获取 DB
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        bill_dict = bill_data.model_dump()
        bill_dict['user_id'] = user_id
        bill_dict['next_due_date'] = bill_data.next_due_date.isoformat() 

        doc_ref = db.collection('bills').add(bill_dict)
        return BillDB(id=doc_ref[1].id, **bill_dict)

    except Exception as e:
        logging.error(f"Error creating bill: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create bill.")


# === 修改：增加 db 参数 ===
async def generate_bill_events(user_id: str, start_date: date, end_date: date, db: Any) -> List[CalendarEvent]:
    """Generates all user-defined bill events within the date range, handling recurrence."""
    if not db:
        return []

    events: List[CalendarEvent] = []
    
    try:
        bills_ref = db.collection('bills').where("user_id", "==", user_id)
        docs = bills_ref.stream()
        
        for doc in docs:
            bill_data = doc.to_dict()
            bill_data['next_due_date'] = date.fromisoformat(bill_data['next_due_date'])
            bill = BillDB(id=doc.id, **bill_data)
            
            current_date = bill.next_due_date
            
            one_cycle = timedelta(days=365) if bill.frequency == "Annually" else timedelta(days=30)
            
            while current_date > start_date + one_cycle:
                current_date = current_date - one_cycle
                
            while current_date <= end_date:
                if current_date >= start_date:
                    events.append(CalendarEvent(
                        event_date=current_date,
                        type="User Bill",
                        name=f"{bill.name} (RM {bill.amount:.2f})",
                        amount=-bill.amount,
                        source="User Input"
                    ))
                
                next_date = get_next_date(current_date, bill.frequency)
                if not next_date or next_date <= current_date:
                    break
                current_date = next_date

    except Exception as e:
        logging.error(f"Error generating user bill events: {e}")
    return events


async def generate_system_recurring_events(user_id: str, db: Any) -> List[CalendarEvent]:
    """Generates calendar events from the recurring detection module."""
    # 这个函数已经接收 db 参数了，所以逻辑是对的，只要确保调用方传入了有效的 db
    events: List[CalendarEvent] = []
    
    recurring_report = await get_recurring_report(user_id, db)
    
    if "error" in recurring_report:
        logging.warning(f"Failed to get recurring report for calendar: {recurring_report['error']}")
        return events
        
    for item in recurring_report.get('recurring_expenses', []):
        if item.get('next_date'):
            events.append(CalendarEvent(
                event_date=date.fromisoformat(item['next_date']),
                type="Bill Due",
                name=f"Recurring Expense: {item['name']} (RM {item['amount']:.2f})",
                amount=-item['amount'],
                source="Subscription Detection"
            ))
            
    for item in recurring_report.get('recurring_income', []):
        if item.get('next_date'):
            events.append(CalendarEvent(
                event_date=date.fromisoformat(item['next_date']),
                type="Income Expected",
                name=f"Fixed Income: {item['name']} (RM {item['amount']:.2f})",
                amount=item['amount'],
                source="Subscription Detection"
            ))

    return events


async def generate_budget_reset_events(user_id: str) -> List[CalendarEvent]:
    """Generates budget reset events for the calendar (always the 1st of the month)."""
    events: List[CalendarEvent] = []
    _, _, _ = get_calculation_dates() 
    
    today = date.today()
    
    for i in range(1, 4):
        
        month_to_add = today.month + i
        year_to_add = today.year + (month_to_add - 1) // 12
        month_to_add = (month_to_add - 1) % 12 + 1
        
        reset_date = date(year_to_add, month_to_add, 1)
        
        events.append(CalendarEvent(
            event_date=reset_date,
            type="Budget Reset",
            name="Monthly Budget Cycle Resets",
            amount=None,
            source="Budget Module"
        ))
        
    return events


@calendar_router.get("/report", response_model=Dict[str, List[CalendarEvent]])
async def get_cash_flow_calendar_report(
    user_id: Annotated[str, Depends(get_current_user_id)],
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """
    Generates a full cash flow calendar report combining user-defined bills,
    recurring payments/income, and budget reset dates for the specified month.
    """
    db = get_db() # 获取 DB
    if not db:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database service unavailable")

    try:
        today = date.today()
        
        if not month or not year:
            target_date = today
        else:
            try:
                target_date = date(year, month, 1)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month or year.")

        start_date = date(target_date.year, target_date.month, 1)
        
        next_month = target_date.month % 12 + 1
        next_year = target_date.year + (target_date.month // 12)
        end_date = date(next_year, next_month, 1) - timedelta(days=1)
        
        # === 修改：传入 db ===
        user_bill_events = await generate_bill_events(user_id, start_date, end_date, db)
        
        system_recurring_events = await generate_system_recurring_events(user_id, db)
        
        budget_reset_events = await generate_budget_reset_events(user_id)
        
        all_events = user_bill_events + system_recurring_events + budget_reset_events
        
        filtered_events: List[CalendarEvent] = []
        
        for event in all_events:
            if start_date <= event.event_date <= end_date:
                filtered_events.append(event)

        calendar_view: Dict[str, List[CalendarEvent]] = defaultdict(list)
        for event in filtered_events:
            calendar_view[event.event_date.isoformat()].append(event)
            
        return calendar_view

    except Exception as e:
        logging.error(f"Calendar Report Generation Failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate calendar report: {str(e)}")