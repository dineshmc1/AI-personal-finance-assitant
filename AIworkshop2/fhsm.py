import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import MinMaxScaler
from typing import List, Dict, Any, Tuple
from datetime import datetime, date

LOOKBACK_DAYS = 30
FORECAST_DAYS = 30 
np.random.seed(42)

def classify_fhs(score: float) -> str:
    """Classifies the FHS into a rating category (0-100 scale)."""
    if score >= 85:
        return "Excellent"
    elif score >= 70:
        return "Good"
    elif score >= 50:
        return "Average"
    elif score >= 30:
        return "Poor"
    else:
        return "Very Poor"

def fetch_and_process_data(transactions: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Converts raw transaction dictionaries into a time-series DataFrame for FHS calculation.
    """
    if not transactions:
        raise ValueError("No transaction data available to generate FHS.")

    data = pd.DataFrame(transactions)

    data["transaction_date"] = pd.to_datetime(data["transaction_date"])
    data = data.sort_values(by="transaction_date")
    
    def get_flow_amount(row):
        return row['amount'] if row['type'].lower() == 'income' else row['amount'] * -1
    
    data['net_flow'] = data.apply(get_flow_amount, axis=1)

    daily_summary = data.groupby("transaction_date").agg(
        income=('net_flow', lambda x: x[x > 0].sum()),
        expense=('net_flow', lambda x: x[x < 0].sum() * -1), 
        net_flow=('net_flow', 'sum')
    ).reset_index().rename(columns={'transaction_date': 'date'}).fillna(0)

    daily_summary['balance'] = daily_summary['net_flow'].cumsum()
    
    date_range = pd.date_range(start=daily_summary["date"].min(), end=daily_summary["date"].max())
    daily_summary = daily_summary.set_index("date").reindex(date_range, fill_value=0).reset_index().rename(columns={'index':'date'})
    
    daily_summary['balance'] = daily_summary['net_flow'].cumsum() 
    daily_summary = daily_summary.round(2)
    
    daily_summary = calculate_fhs_components(daily_summary)
    
    return daily_summary

def calculate_fhs_components(df: pd.DataFrame) -> pd.DataFrame:
    """Calculates the composite Financial Health Score (FHS) components."""
    
    net_flow_scaler = MinMaxScaler(feature_range=(0, 35))
    df['fhs_net_flow'] = net_flow_scaler.fit_transform(df['net_flow'].fillna(0).values.reshape(-1, 1))

    liquidity_scaler = MinMaxScaler(feature_range=(0, 40))
    df['fhs_liquidity'] = liquidity_scaler.fit_transform(df['balance'].fillna(0).values.reshape(-1, 1))

    volatility_30d = df['expense'].rolling(window=LOOKBACK_DAYS).std().fillna(df['expense'].std() if not df['expense'].empty else 0)    
    volatility_scaler = MinMaxScaler()
    if volatility_30d.std() == 0:
         scaled_volatility = np.zeros(len(df))
    else:
        scaled_volatility = volatility_scaler.fit_transform(volatility_30d.values.reshape(-1, 1))
    
    df['fhs_volatility'] = (1 - scaled_volatility) * 25
    
    df['fhs'] = df['fhs_net_flow'] + df['fhs_liquidity'] + df['fhs_volatility']
    return df

def create_regression_features(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, pd.Series, List[str], MinMaxScaler]:
    """Creates rolling 30-day features for the regression model."""
    
    rolling_features = pd.DataFrame(index=df.index)
    
    rolling_features['avg_income_30d'] = df['income'].rolling(window=LOOKBACK_DAYS).mean()
    rolling_features['avg_expense_30d'] = df['expense'].rolling(window=LOOKBACK_DAYS).mean()
    
    def calculate_slope(series):
        if len(series) < LOOKBACK_DAYS or series.isnull().all():
            return 0
        X = np.arange(len(series)).reshape(-1, 1)
        y = series.values
        return LinearRegression().fit(X, y).coef_[0]

    rolling_features['balance_slope_30d'] = df['balance'].rolling(window=LOOKBACK_DAYS).apply(calculate_slope, raw=False).fillna(0)
    
    rolling_features['day_of_week'] = df['date'].dt.dayofweek
    rolling_features['day_of_month'] = df['date'].dt.day
    
    rolling_features['expense_volatility_30d'] = df['expense'].rolling(window=LOOKBACK_DAYS).std().fillna(df['expense'].std() if not df['expense'].empty else 0)
    X = rolling_features.iloc[LOOKBACK_DAYS:].values
    y = df['fhs'].iloc[LOOKBACK_DAYS:].values
    dates = df['date'].iloc[LOOKBACK_DAYS:]
    feature_names = rolling_features.iloc[LOOKBACK_DAYS:].columns.tolist()

    scaler_X = MinMaxScaler()
    X_scaled = scaler_X.fit_transform(X)
    
    return X_scaled, y, dates, feature_names, scaler_X

def generate_fhs_report(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    try:
        daily_summary = fetch_and_process_data(transactions)
    except ValueError as e:
        return {"error": str(e)}
        
    if len(daily_summary) < LOOKBACK_DAYS + FORECAST_DAYS:
        # 如果数据不够，不仅返回error，还可以返回一个默认的Mock FHS，防止前端挂掉
        # 但这里保持原逻辑返回 error 也可以，main.py 已经处理了降级
        return {"error": f"Not enough historical data ({len(daily_summary)} days). Need {LOOKBACK_DAYS + FORECAST_DAYS}."}

    X_scaled, y, dates, feature_names, scaler_X = create_regression_features(daily_summary)

    if len(X_scaled) == 0:
         return {"error": "Insufficient data after processing features."}

    model = LinearRegression()
    model.fit(X_scaled, y) 

    historical_fhs_pred = model.predict(X_scaled)

    forecast_fhs = []
    current_features_scaled = X_scaled[-1].reshape(1, -1)
    
    current_income_avg = daily_summary['income'].tail(LOOKBACK_DAYS).mean()
    current_expense_avg = daily_summary['expense'].tail(LOOKBACK_DAYS).mean()
    
    last_date = daily_summary['date'].iloc[-1]
    last_features_raw = scaler_X.inverse_transform(X_scaled[-1].reshape(1, -1))[0] 

    for i in range(1, FORECAST_DAYS + 1):
        pred_fhs = model.predict(current_features_scaled)[0]
        forecast_fhs.append(pred_fhs)
        
        next_date = last_date + pd.Timedelta(days=i)
        
        next_features_raw = np.array([
            current_income_avg,                      
            current_expense_avg,                     
            last_features_raw[2],                    
            next_date.dayofweek,                     
            next_date.day,                          
            last_features_raw[5]                    
        ])
        
        current_features_scaled = scaler_X.transform(next_features_raw.reshape(1, -1))
        
    future_dates = pd.date_range(last_date + pd.Timedelta(days=1), periods=FORECAST_DAYS).tolist()
    
    latest_actual_fhs = daily_summary['fhs'].iloc[-1]
    
    # === 关键修复：强制转换所有 numpy 类型为 float ===
    historical_results = [
        {
            "date": date_obj.strftime("%Y-%m-%d"), 
            "actual_fhs": float(round(actual, 2)), 
            "predicted_fhs": float(round(pred, 2))
        }
        for date_obj, actual, pred in zip(dates, y, historical_fhs_pred)
    ]

    forecast_results = [
        {
            "date": date_obj.strftime("%Y-%m-%d"), 
            "forecast_fhs": float(round(fhs, 2))
        }
        for date_obj, fhs in zip(future_dates, forecast_fhs)
    ]
    
    return {
        "summary": {
            "latest_fhs": float(round(latest_actual_fhs, 2)),
            "latest_rating": classify_fhs(latest_actual_fhs),
            "forecast_fhs": float(round(forecast_fhs[-1], 2)),
            "forecast_rating": classify_fhs(forecast_fhs[-1]),
            "model_notes": "Linear Regression based on 30-day rolling averages."
        },
        "historical_fhs": historical_results,
        "forecast_fhs": forecast_results
    }