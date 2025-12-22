import json
import random
from datetime import datetime, timedelta

# --- CONFIGURATION ---
USER_ID = "SykmkOcfYPfIGB4WBW2wZv3e3Rn2"
ACCOUNT_ID = "0fwAfxnprEOOwzOn2gDD"

# Explicitly set 1 full year back from today
END_DATE = datetime(2025, 12, 16)
START_DATE = datetime(2024, 12, 16) 

# --- PERSONA FINANCIAL MODEL ---
transactions = []

def add_transaction(date_obj, amount, category, merchant, type_str):
    # Randomize time logic to make it look real
    if category == "Drink": # Morning coffee
        hour = random.randint(7, 11)
    elif category == "Food" and amount > 100: # Dinner
        hour = random.randint(18, 22)
    else:
        hour = random.randint(8, 23)
        
    minute = random.randint(0, 59)
    time_str = f"{hour:02d}:{minute:02d}"
    
    date_str = date_obj.strftime("%Y-%m-%d")
    
    txn = {
        "user_id": USER_ID,
        "account_id": ACCOUNT_ID,
        "amount": round(float(amount), 2),
        "category": category,
        "merchant": merchant,
        "transaction_date": date_str,
        "transaction_time": time_str,
        "type": type_str
    }
    transactions.append(txn)

# --- GENERATION LOOP ---
current_date = START_DATE
print(f"Generating data from {START_DATE.date()} to {END_DATE.date()}...")

while current_date <= END_DATE:
    day = current_date.day
    is_weekend = current_date.weekday() >= 5
    
    # ---------------------------------------------------
    # 1. FIXED MONTHLY BILLS & INCOME (The "Boring" Stuff)
    # ---------------------------------------------------
    if day == 28: 
        add_transaction(current_date, 28500, "Salary", "FAANG Payroll Corp", "Income")
    if day == 5: 
        # Fluctuate revenue slightly
        amt = random.uniform(34000, 36000) 
        add_transaction(current_date, amt, "Freelance", "App Store Payout", "Income")
    if day == 10: 
        amt = random.uniform(11000, 14000)
        add_transaction(current_date, amt, "Freelance", "Holdings LLC (CarWash/Laundromat)", "Income")
    if day == 1: 
        add_transaction(current_date, 6000, "Investment", "Property Management Inc", "Income")

    if day == 2:
        add_transaction(current_date, 14500, "Housing", "Mansion Mortgage", "Expense")
    if day == 15:
        add_transaction(current_date, 3200, "Vehicle", "Porsche Financial", "Expense")
        add_transaction(current_date, 1800, "Vehicle", "BMW Financial", "Expense")
    if day == 20:
        add_transaction(current_date, 1200, "Bills", "Utilities & Server Costs", "Expense")

    # ---------------------------------------------------
    # 2. DAILY LIFESTYLE (The "Rich" Stuff - High Frequency)
    # ---------------------------------------------------
    
    # A. Morning Routine (Coffee/Breakfast) - 80% chance every day
    if random.random() < 0.8:
        merchants = ["Starbucks", "Local Roastery", "Blue Bottle", "Pressed Juicery"]
        add_transaction(current_date, random.uniform(15, 45), "Drink", random.choice(merchants), "Expense")

    # B. Lunch (Work days vs Weekend) - Almost daily
    merchants = ["Sweetgreen", "Chipotle", "Sushi Spot", "Whole Foods Bar", "UberEats"]
    add_transaction(current_date, random.uniform(30, 80), "Food", random.choice(merchants), "Expense")

    # C. Dinner (Varies)
    if random.random() < 0.6: # 60% chance of eating out for dinner
        merchants = ["Nobu", "Steakhouse", "Italian Bistro", "DoorDash Premium"]
        add_transaction(current_date, random.uniform(80, 400), "Food", random.choice(merchants), "Expense")

    # D. Transport (Uber/Gas)
    if random.random() < 0.3:
        add_transaction(current_date, random.uniform(40, 150), "Vehicle", "Shell / Uber Black", "Expense")

    # E. Random Shopping / Entertainment (Impulse buys)
    if random.random() < 0.2: # 20% chance daily
        items = [
            ("Shopping", "Amazon", 50, 200),
            ("Shopping", "Apple Services", 10, 50),
            ("Entertainment", "Steam / PS5", 60, 100),
            ("Shopping", "Mr Porter", 200, 800)
        ]
        cat, merch, min_a, max_a = random.choice(items)
        add_transaction(current_date, random.uniform(min_a, max_a), cat, merch, "Expense")

    # ---------------------------------------------------
    # 3. TRADING BOT (Random Income Spikes)
    # ---------------------------------------------------
    if random.random() < 0.05: # ~1-2 times a month irregularly
        profit = random.uniform(2000, 9000)
        add_transaction(current_date, profit, "Investment", "Quant Bot Payout", "Income")

    # Increment day
    current_date += timedelta(days=1)

# --- OUTPUT & VERIFICATION ---
file_path = "transactions.json"
with open(file_path, "w") as f:
    json.dump(transactions, f, indent=2)

print(f"--------------------------------------------------")
print(f"DONE! Generated {len(transactions)} transactions.")
print(f"File saved to: {file_path}")
print(f"First Transaction Date: {transactions[0]['transaction_date']}")
print(f"Last Transaction Date: {transactions[-1]['transaction_date']}")
print(f"--------------------------------------------------")
