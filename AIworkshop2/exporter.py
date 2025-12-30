# AI workshop 2/exporter.py
import os
import io
import datetime
import matplotlib.pyplot as plt
import numpy as np
from typing import Dict, Any, List
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.units import inch

from lstm import generate_lstm_forecast
from fhsm import generate_fhs_report

def generate_user_pdf_report(user_id: str, db: Any) -> io.BytesIO:
    """
    Generates a full financial PDF report for the user.
    """
    # 1. Fetch Data
    # Transactions
    transactions_ref = db.collection('transactions').where("user_id", "==", user_id).order_by("transaction_date")
    transaction_docs = transactions_ref.stream()
    transactions = [doc.to_dict() for doc in transaction_docs]

    # Accounts
    accounts_ref = db.collection('accounts').where("user_id", "==", user_id)
    accounts = [doc.to_dict() for doc in accounts_ref.stream()]
    total_balance = sum(acc.get('current_balance', 0.0) for acc in accounts)

    # Goals
    goals_ref = db.collection('goals').where("user_id", "==", user_id)
    goals = [doc.to_dict() for doc in goals_ref.stream()]

    # Budgets
    budgets_ref = db.collection('budgets').where("user_id", "==", user_id)
    budgets = [doc.to_dict() for doc in budgets_ref.stream()]

    # Saved Portfolio
    portfolio_doc = db.collection('portfolio_optimizations').document(user_id).get()
    portfolio = portfolio_doc.to_dict() if portfolio_doc.exists else None

    # FHS Report
    fhs_report = generate_fhs_report(transactions)
    summary = fhs_report.get('summary', {})
    latest_fhs = summary.get('latest_fhs', 'N/A')
    latest_rating = summary.get('latest_rating', 'Unknown')

    # Income/Expense Metrics (Last 30 days or current)
    total_income = sum(t.get('amount', 0.0) for t in transactions if t.get('type') == 'Income')
    total_expense = sum(t.get('amount', 0.0) for t in transactions if t.get('type') == 'Expense')

    # LSTM Forecast
    lstm_report = generate_lstm_forecast(transactions)
    forecast_results = lstm_report.get('forecast_results', [])

    # 2. PDF Setup
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor("#4F46E5"),
        spaceAfter=20,
        alignment=1 # Center
    )
    
    section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor("#1F2937"),
        spaceBefore=15,
        spaceAfter=10
    )

    elements = []

    # Title
    elements.append(Paragraph("AI Personal Finance Assistant", title_style))
    elements.append(Paragraph(f"Financial Summary Report - {datetime.date.today()}", styles['Normal']))
    elements.append(Paragraph(f"User ID: {user_id}", styles['Normal']))
    elements.append(Spacer(1, 0.25 * inch))

    # --- Section: Key Metrics ---
    elements.append(Paragraph("Key Financial Metrics", section_title))
    metrics_data = [
        ["Metric", "Value"],
        ["Financial Health Score", f"{latest_fhs} ({latest_rating})"],
        ["Total Net Balance", f"RM {total_balance:,.2f}"],
        ["Lifetime Income", f"RM {total_income:,.2f}"],
        ["Lifetime Expenses", f"RM {total_expense:,.2f}"],
    ]
    t = Table(metrics_data, colWidths=[2.5 * inch, 2.5 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#374151")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#E5E7EB"))
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.25 * inch))

    # --- Section: Goals ---
    if goals:
        elements.append(Paragraph("Financial Goals", section_title))
        goals_header = [["Goal Name", "Target Amount", "Current Saved", "Progress"]]
        goals_rows = []
        for g in goals:
            target = g.get('target_amount', 1.0)
            saved = g.get('current_saved', 0.0)
            progress = (saved / target) * 100
            goals_rows.append([
                g.get('name', 'Unnamed'),
                f"RM {target:,.2f}",
                f"RM {saved:,.2f}",
                f"{progress:.1f}%"
            ])
        t_goals = Table(goals_header + goals_rows, colWidths=[2 * inch, 1.5 * inch, 1.5 * inch, 1 * inch])
        t_goals.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
        ]))
        elements.append(t_goals)
        elements.append(Spacer(1, 0.25 * inch))

    # --- Section: Budget ---
    if budgets:
        elements.append(Paragraph("Active Budgets", section_title))
        budget_header = [["Category", "Monthly Limit", "Period"]]
        budget_rows = [[b.get('category', 'General'), f"RM {b.get('limit_amount', 0):,.2f}", b.get('period', 'Monthly')] for b in budgets]
        t_budget = Table(budget_header + budget_rows, colWidths=[2 * inch, 2 * inch, 1 * inch])
        t_budget.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#10B981")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
        ]))
        elements.append(t_budget)
        elements.append(Spacer(1, 0.25 * inch))

    # --- Section: Saved Portfolio ---
    if portfolio:
        elements.append(Paragraph("Optimized Strategy (RL)", section_title))
        weights = portfolio.get('optimized_weights', {})
        perf = portfolio.get('rl_performance', {})
        
        perf_text = f"Expected Annual Return: {perf.get('annual_return_pct', 'N/A')}% | Sharpe Ratio: {perf.get('sharpe_ratio', 'N/A')}"
        elements.append(Paragraph(perf_text, styles['Italic']))
        
        portfolio_header = [["Asset Class", "Allocation (%)"]]
        portfolio_rows = [[k, f"{v}%"] for k, v in weights.items() if v > 0]
        t_portfolio = Table(portfolio_header + portfolio_rows, colWidths=[2 * inch, 1.5 * inch])
        t_portfolio.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F59E0B")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
        ]))
        elements.append(t_portfolio)
        elements.append(Spacer(1, 0.25 * inch))

    # --- Section: Forecast Chart ---
    if forecast_results:
        elements.append(Paragraph("30-Day Balance Forecast", section_title))
        
        # Generate chart with matplotlib
        plt.figure(figsize=(6, 3))
        balances = [float(r.get('forecast_balance', 0)) for r in forecast_results]
        plt.plot(balances, color='#4F46E5', linewidth=2, marker='o', markersize=3)
        plt.fill_between(range(len(balances)), balances, alpha=0.1, color='#4F46E5')
        plt.title("Predicted Balance Projection")
        plt.xlabel("Days (Future)")
        plt.ylabel("Balance (RM)")
        plt.grid(True, linestyle='--', alpha=0.6)
        
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', bbox_inches='tight', dpi=100)
        img_buffer.seek(0)
        plt.close()
        
        elements.append(RLImage(img_buffer, width=5*inch, height=2.5*inch))
        elements.append(Spacer(1, 0.25 * inch))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
