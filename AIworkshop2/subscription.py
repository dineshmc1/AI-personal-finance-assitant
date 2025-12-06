# AI workshop 2/subscription.py
import pandas as pd
from typing import List, Dict, Any, Literal
from datetime import date, timedelta
from collections import defaultdict
import difflib
import logging

logging.basicConfig(level=logging.INFO)


MIN_OCCURRENCES = 3 
MAX_DAY_VARIATION = 4 
MERCHANT_SIMILARITY_THRESHOLD = 0.9 
AMOUNT_DEVIATION_PCT = 0.05 


def normalize_text(text: str) -> str:
    """Standardize text for comparison."""
    return str(text).strip().lower().replace('.', '').replace(',', '').replace(' ', '')

def calculate_recurring_metrics(group: pd.DataFrame) -> Dict[str, Any]:
    """Calculates stability metrics for a potential recurring group."""
    
    dates = pd.to_datetime(group['transaction_date']).sort_values()
    if len(dates) < 2:
        avg_frequency = 0
    else:
        time_diffs = dates.diff().dropna()
        avg_frequency = time_diffs.apply(lambda x: x.days).mean()
        
    avg_amount = group['amount'].mean()
    std_amount = group['amount'].std()
    
    if avg_amount > 0:
        amount_variation = (std_amount / avg_amount) if pd.notna(std_amount) else 0.0
    else:
        amount_variation = float('inf')

    last_date = dates.iloc[-1]
    next_date = (last_date + timedelta(days=round(avg_frequency))) if avg_frequency > 0 else None
    
    merchant = group['merchant'].iloc[0]
    
    return {
        "count": len(group),
        "amount_mean": round(avg_amount, 2),
        "amount_deviation": round(amount_variation, 4), 
        "frequency_days": round(avg_frequency, 2),
        "last_date": last_date.isoformat(),
        "next_projected_date": next_date.isoformat() if next_date else None,
        "merchant": merchant,
    }


def find_similar_merchants(df: pd.DataFrame) -> pd.DataFrame:
    """
    Groups transactions by similar merchant names before grouping by amount/frequency.
    This helps capture 'Netflix' vs 'Netflix Inc' vs 'NFX'.
    """
    if df.empty:
        return df
        
    normalized_names = df['merchant'].apply(normalize_text).unique()
    merchant_map = {}
    
    for name in normalized_names:
        merchant_map[name] = name 
        
    for i in range(len(normalized_names)):
        name1 = normalized_names[i]
        
        for j in range(i + 1, len(normalized_names)):
            name2 = normalized_names[j]
            
            similarity = difflib.SequenceMatcher(None, name1, name2).ratio()
            
            if similarity >= MERCHANT_SIMILARITY_THRESHOLD:
                canonical_name = name1 if len(name1) < len(name2) else name2
                merchant_map[name1] = canonical_name
                merchant_map[name2] = canonical_name

    df['canonical_merchant'] = df['merchant'].apply(lambda x: merchant_map.get(normalize_text(x), normalize_text(x)))
    
    return df


def detect_recurring_transactions(
    transactions: List[Dict[str, Any]], 
    flow_type: Literal['Income', 'Expense']
) -> List[Dict[str, Any]]:
    """
    Identifies recurring payments or income sources in the transaction list.
    """
    if not transactions:
        return []

    df = pd.DataFrame(transactions)
    df["transaction_date"] = pd.to_datetime(df["transaction_date"])
    
    flow_df = df[df['type'] == flow_type].copy()
    if flow_df.empty:
        return []
        
    flow_df = find_similar_merchants(flow_df)

    
    flow_df['amount_group'] = (flow_df['amount'] * 10).round(0) / 10 
    
    recurring_candidates = flow_df.groupby(['canonical_merchant', 'amount_group']).apply(calculate_recurring_metrics).reset_index(drop=True)

    
    filtered_candidates = []
    
    for _, row in recurring_candidates.iterrows():
        if row['count'] < MIN_OCCURRENCES:
            continue
            
        
        is_monthly = abs(row['frequency_days'] - 30.0) <= MAX_DAY_VARIATION
        is_fortnightly = abs(row['frequency_days'] - 14.0) <= MAX_DAY_VARIATION
        
        if not (is_monthly or is_fortnightly):
            continue 
            
        if row['amount_deviation'] > AMOUNT_DEVIATION_PCT:
            continue
            
        filtered_candidates.append({
            "flow_type": flow_type,
            "name": row['merchant'],
            "amount": row['amount_mean'],
            "frequency_days": row['frequency_days'],
            "count": row['count'],
            "next_date": row['next_projected_date'],
            "notes": "Detected based on stable pattern of amount, date, and merchant/source."
        })
        
    return filtered_candidates



async def get_recurring_report(user_id: str, db: Any) -> Dict[str, Any]:
    """
    Retrieves all transactions for a user and returns a report of detected
    recurring income and expenses for the next month.
    """
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
                "recurring_expenses": [],
                "recurring_income": [],
                "summary": "No transactions available to detect recurring patterns."
            }

        recurring_expenses = detect_recurring_transactions(transactions, 'Expense')
        
        recurring_income = detect_recurring_transactions(transactions, 'Income')
        
        next_month_start = date.today().replace(day=1) + timedelta(days=32)
        next_month_start = next_month_start.replace(day=1) 
        
        total_expense = sum(item['amount'] for item in recurring_expenses if item['next_date'])
        total_income = sum(item['amount'] for item in recurring_income if item['next_date'])

        summary_message = (
            f"You have **RM {total_expense:,.2f}** in projected recurring expenses (bills and subscriptions) "
            f"and **RM {total_income:,.2f}** in projected fixed income next month."
        )

        return {
            "recurring_expenses": recurring_expenses,
            "recurring_income": recurring_income,
            "total_projected_expense_next_month": round(total_expense, 2),
            "total_projected_income_next_month": round(total_income, 2),
            "summary": summary_message
        }

    except Exception as e:
        logging.error(f"Error in recurring payment detection: {e}")
        return {"error": f"Failed to generate recurring report: {str(e)}"}