import firebase_admin
from firebase_admin import firestore
import datetime
from datetime import timezone
import calendar

async def recalculate_user_history(user_id: str, db: firestore.client) -> dict:
    """
    Replays all transactions to generate monthly_stats and update total_balance.
    Returns the summary of the operation.
    """
    try:
        # 1. Fetch ALL transactions (ascending order)
        transactions_ref = db.collection('transactions').where("user_id", "==", user_id).order_by("transaction_date")
        docs = transactions_ref.stream()
        
        transactions = []
        for doc in docs:
            t = doc.to_dict()
            # Normalize date
            raw_date = t.get('transaction_date')
            t_date = None
            if hasattr(raw_date, 'to_datetime'):
                t_date = raw_date.to_datetime().replace(tzinfo=timezone.utc)
            elif isinstance(raw_date, str):
                try:
                     t_date = datetime.datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
                except:
                     t_date = datetime.datetime.strptime(raw_date[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            
            if t_date:
                t['parsed_date'] = t_date
                transactions.append(t)
        
        # Sort just in case stream wasn't perfectly ordered or dates mixed
        transactions.sort(key=lambda x: x['parsed_date'])
        
        monthly_data = {} # Key: "YYYY-MM" -> { income, expense, ending_balance }
        current_balance = 0.0
        
        for t in transactions:
            amount = float(t.get('amount', 0))
            txn_type = t.get('type', '').lower()
            
            # Update Running Balance
            if txn_type == 'income':
                current_balance += amount
            elif txn_type in ['expense', 'expend']:
                current_balance -= amount
                
            # Update Monthly Stats
            date_key = t['parsed_date'].strftime("%Y-%m")
            if date_key not in monthly_data:
                monthly_data[date_key] = {
                    "month": t['parsed_date'].month,
                    "year": t['parsed_date'].year,
                    "total_income": 0.0,
                    "total_expense": 0.0,
                    "ending_balance": 0.0 
                }
            
            if txn_type == 'income':
                 monthly_data[date_key]['total_income'] += amount
            elif txn_type in ['expense', 'expend']:
                 monthly_data[date_key]['total_expense'] += amount
            
            # Important: The balance at the end of this transaction is the current state of that month (so far)
            # When we finish processing a month, the last 'current_balance' is the ending_balance.
            # But since we iterate linearly, we can just constantly update ending_balance of that month to current_balance
            # This handles multiple months correctly because balance carries over.
            monthly_data[date_key]['ending_balance'] = current_balance

        # 2. Write to Firestore (Batch)
        batch = db.batch()
        user_ref = db.collection('users').document(user_id)
        
        # Update Main User Doc
        batch.set(user_ref, {
            "total_balance": current_balance,
            "last_updated": datetime.datetime.now(timezone.utc),
            "currency": "MYR" # Default or fetch from settings if exists
        }, merge=True)
        
        # Update Monthly Stats
        for date_key, data in monthly_data.items():
            stats_ref = user_ref.collection('monthly_stats').document(date_key)
            batch.set(stats_ref, data)
            
            # Update New Monthly Balances Collection (Sync)
            monthly_balance_val = data['total_income'] - data['total_expense']
            new_doc_id = f"{user_id}_{data['year']}_{data['month']}"
            new_ref = db.collection('monthly_balances').document(new_doc_id)
            batch.set(new_ref, {
                "user_id": user_id,
                "year": data['year'],
                "month": data['month'],
                "balance": monthly_balance_val,
                "monthly_balance": monthly_balance_val,
                "total_income": data['total_income'],
                "total_expense": data['total_expense']
            }, merge=True)
            
        batch.commit()
        
        return {
            "status": "success",
            "final_balance": current_balance,
            "months_processed": len(monthly_data)
        }
        
    except Exception as e:
        print(f"Error recalculating history: {e}")
        return {"status": "error", "message": str(e)}

async def get_average_metrics_last_3_months(user_id: str, db: firestore.client) -> dict:
    """
    Fetches average income and expense for the last 3 completed months.
    Excludes the current month.
    """
    try:
        stats_ref = db.collection('monthly_balances').where("user_id", "==", user_id)\
            .order_by("year", direction=firestore.Query.DESCENDING)\
            .order_by("month", direction=firestore.Query.DESCENDING)\
            .limit(5)
            
        docs = stats_ref.stream()
        
        income_list = []
        expense_list = []
        now = datetime.datetime.now()
        
        for doc in docs:
            data = doc.to_dict()
            doc_year = data.get('year')
            doc_month = data.get('month')
            
            if doc_year == now.year and doc_month == now.month:
                continue
                
            inc = data.get('total_income', 0.0)
            exp = data.get('total_expense', 0.0)
            
            income_list.append(float(inc))
            expense_list.append(float(exp))
            
            if len(income_list) == 3:
                break
            
        if not income_list:
            print("No previous monthly data found. Recalculating...")
            await recalculate_user_history(user_id, db)
            # Re-fetch after recalculation
            return await get_average_metrics_last_3_months(user_id, db)

        avg_income = sum(income_list) / len(income_list)
        avg_expense = sum(expense_list) / len(expense_list)
        
        return {
            "avg_monthly_income": float(round(avg_income, 2)),
            "avg_monthly_spending": float(round(avg_expense, 2)),
            "num_months": len(income_list)
        }
        
    except Exception as e:
        print(f"Error fetching avg metrics: {e}")
        return {"avg_monthly_income": 0.0, "avg_monthly_spending": 0.0, "num_months": 0}

async def get_average_balance_last_3_months(user_id: str, db: firestore.client) -> float:
    """
    Fetches the average 'balance' of the last 3 *completed* months from 'monthly_balances' collection.
    Excludes the current month.
    """
    try:
        # Fetch more than 3 to allow skipping current month
        stats_ref = db.collection('monthly_balances').where("user_id", "==", user_id)\
            .order_by("year", direction=firestore.Query.DESCENDING)\
            .order_by("month", direction=firestore.Query.DESCENDING)\
            .limit(5)
            
        docs = stats_ref.stream()
        
        balances = []
        now = datetime.datetime.now()
        current_month_key = (now.year, now.month)
        
        print(f"DEBUG_AVG_BAL: Current Month: {current_month_key}")
        
        for doc in docs:
            data = doc.to_dict()
            doc_year = data.get('year')
            doc_month = data.get('month')
            
            # Skip current month
            if doc_year == now.year and doc_month == now.month:
                print(f"DEBUG_AVG_BAL: Skipping current month {doc_year}-{doc_month}")
                continue
                
            # Support both 'balance' and 'monthly_balance' (legacy)
            val = data.get('balance')
            if val is None:
                val = data.get('monthly_balance', 0.0)
            
            print(f"DEBUG_AVG_BAL: Using {doc_year}-{doc_month} = {val}")
            balances.append(float(val))
            
            if len(balances) == 3:
                break
            
        if not balances:
            print("No previous monthly balances found. Triggering backfill...")
            result = await recalculate_user_history(user_id, db)
            if result['status'] == 'success' and result['months_processed'] > 0:
                # Retry fetch (recursive call might hit infinite loop if logic flaw, so careful)
                # But since we limit 5 and skip 1, we should be fine if data exists.
                return await get_average_balance_last_3_months(user_id, db)
            else:
                return 0.0
        
        # If we have less than 3 months, average what we have? 
        # User asked for "last 3 months", if only 2 exist, average of 2 is best effort.
        avg_balance = sum(balances) / len(balances)
        print(f"DEBUG_AVG_BAL: Calculated Average: {avg_balance}")
        return float(round(avg_balance, 2))
        
    except Exception as e:
        print(f"Error fetching avg balance: {e}")
        return 0.0
