# tests/test_twin_logic.py
import sys
import os

# Add the project directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'AIworkshop2')))

try:
    from twin import generate_twin_logic
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def test_twin_logic_scenarios():
    scenarios = [
        {"income": 5000, "expenses": 4000, "desc": "Normal User (20% savings)"},
        {"income": 5000, "expenses": 5500, "desc": "Overspending User (-10% savings)"},
        {"income": 5000, "expenses": 1000, "desc": "Super Saver (80% savings)"},
        {"income": 10000, "expenses": 8000, "desc": "High Income (20% savings)"},
    ]

    for s in scenarios:
        print(f"\n--- Testing Scenario: {s['desc']} ---")
        income = s['income']
        expenses = s['expenses']
        # Dummy transactions
        transactions = [
            {"type": "Expense", "amount": expenses * 0.6, "category": "Housing"},
            {"type": "Expense", "amount": expenses * 0.4, "category": "Food"},
            {"type": "Income", "amount": income, "category": "Salary"}
        ]
        
        result = generate_twin_logic(income, expenses, transactions)
        
        user = result['user']
        easy = result['easy']
        medium = result['medium']
        hard = result['hard']
        
        print(f"User:   Rate={user.savings_rate:.1f}%, Balance={user.balance}, XP={user.potential_xp}")
        print(f"Easy:   Rate={easy.savings_rate:.1f}%, Balance={easy.balance}, XP={easy.potential_xp}")
        print(f"Medium: Rate={medium.savings_rate:.1f}%, Balance={medium.balance}, XP={medium.potential_xp}")
        print(f"Hard:   Rate={hard.savings_rate:.1f}%, Balance={hard.balance}, XP={hard.potential_xp}")
        
        # Assertions
        assert easy.savings_rate == 20.0
        assert medium.savings_rate == 50.0
        assert hard.savings_rate == 70.0
        assert easy.potential_xp == 100
        assert medium.potential_xp == 300
        assert hard.potential_xp == 600

if __name__ == "__main__":
    test_twin_logic_scenarios()
    print("\n✅ All twin logic tests passed!")
