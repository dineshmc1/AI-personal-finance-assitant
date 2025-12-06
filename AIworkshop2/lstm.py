# AI workshop 2/lstm.py
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from typing import List, Dict, Any
from datetime import datetime, date, timedelta


LOOKBACK = 30           
FORECAST_DAYS = 30      
EPOCHS = 50             
BATCH_SIZE = 16         
LR = 0.001              
DEVICE = "cpu"          
INPUT_FEATURES = ["income", "expense", "balance", "day_of_week", "day_of_month"]
TARGET_FEATURES = ["income", "expense"] 


class MultiOutputLSTM(nn.Module):
    def __init__(self, input_size: int, output_size: int = 2, hidden_size: int = 64, num_layers: int = 2):
        super(MultiOutputLSTM, self).__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        out = out[:, -1, :]
        out = self.fc(out)
        return out



def preprocess_transactions(transactions: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Converts raw transactions to a daily summary DataFrame.
    """
    if not transactions:
        raise ValueError("No transaction data available for forecasting.")

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
    
    min_date = daily_summary["date"].min()
    max_date = daily_summary["date"].max()
    date_range = pd.date_range(start=min_date, end=max_date)
    daily_summary = daily_summary.set_index("date").reindex(date_range, fill_value=0).reset_index().rename(columns={'index':'date'})
    
   
    daily_summary['balance'] = daily_summary['net_flow'].cumsum() 
    
    daily_summary['day_of_week'] = daily_summary['date'].dt.dayofweek
    daily_summary['day_of_month'] = daily_summary['date'].dt.day
    
    return daily_summary.round(2)

def create_sequences(data: np.ndarray, flow_data: np.ndarray, lookback: int, target_indices: List[int]) -> tuple[np.ndarray, np.ndarray]:
    """Creates sequences (X) and targets (y) for LSTM training."""
    X, y = [], []
    for i in range(lookback, len(data)):
        X.append(data[i - lookback:i])
        y.append(flow_data[i, target_indices])
    return np.array(X), np.array(y)



def generate_lstm_forecast(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Main function to run the LSTM model training and 30-day forecast.
    Returns a dictionary suitable for JSON API response.
    """
    try:
        daily_summary = preprocess_transactions(transactions)
    except ValueError as e:
        return {"error": str(e)}

    if len(daily_summary) < LOOKBACK * 2: 
        return {"error": f"Not enough historical data (only {len(daily_summary)} days). Minimum required is {LOOKBACK * 2} days for stable training."}

    scaler_flow = MinMaxScaler(feature_range=(0, 1))
    scaler_time = MinMaxScaler(feature_range=(0, 1))

    flow_data = daily_summary[["income", "expense", "balance"]].values
    time_data = daily_summary[["day_of_week", "day_of_month"]].values

    scaled_flow = scaler_flow.fit_transform(flow_data)
    scaled_time = scaler_time.fit_transform(time_data)
    scaled_features = np.concatenate((scaled_flow, scaled_time), axis=1)

    target_indices = [0, 1] 
    X, y = create_sequences(scaled_features, flow_data, LOOKBACK, target_indices)

    X_tensor = torch.tensor(X, dtype=torch.float32)
    y_tensor = torch.tensor(y, dtype=torch.float32)
    dataset = TensorDataset(X_tensor, y_tensor)
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    INPUT_SIZE = X_tensor.shape[2]
    OUTPUT_SIZE = y_tensor.shape[1]

    model = MultiOutputLSTM(input_size=INPUT_SIZE, output_size=OUTPUT_SIZE).to(DEVICE)
    criterion = nn.MSELoss() 
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    model.train()
    for _ in range(EPOCHS):
        for batch_X, batch_y in loader:
            batch_X, batch_y = batch_X.to(DEVICE), batch_y.to(DEVICE)
            optimizer.zero_grad()
            output = model(batch_X)
            loss = criterion(output, batch_y)
            loss.backward()
            optimizer.step()

    model.eval()
    last_seq = torch.tensor(scaled_features[-LOOKBACK:], dtype=torch.float32).unsqueeze(0).to(DEVICE)
    forecast_flows = []
    current_balance = daily_summary["balance"].iloc[-1]
    last_date = daily_summary["date"].iloc[-1].date()
    forecast_balances = []
    future_dates = []

    for i in range(FORECAST_DAYS):
        with torch.no_grad():
            pred_flows_raw = model(last_seq)
        
        pred_income = max(0.0, pred_flows_raw[0, 0].item())
        pred_expense = max(0.0, pred_flows_raw[0, 1].item())
        
        forecast_flows.append([pred_income, pred_expense])
        
        current_balance = current_balance + pred_income - pred_expense
        forecast_balances.append(current_balance)
        
        next_date = last_date + timedelta(days=i + 1)
        future_dates.append(next_date)
        
        next_flow_raw = np.array([pred_income, pred_expense, current_balance])
        
        next_flow_scaled = scaler_flow.transform(next_flow_raw.reshape(1, -1)).flatten()
        
        next_time_raw = np.array([next_date.weekday(), next_date.day]) # weekday is 0-6
        next_time_scaled = scaler_time.transform(next_time_raw.reshape(1, -1)).flatten()
        
        next_input_scaled = np.concatenate((next_flow_scaled, next_time_scaled))
        
        next_input_tensor = torch.tensor(next_input_scaled, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(DEVICE)
        new_seq = torch.cat((last_seq[:, 1:, :], next_input_tensor), dim=1)
        last_seq = new_seq
        
    forecast_flows = np.array(forecast_flows)

    forecast_total_income = round(forecast_flows[:, 0].sum(), 2)
    forecast_total_expense = round(forecast_flows[:, 1].sum(), 2)
    forecast_final_balance = round(forecast_balances[-1], 2)
    
    forecast_results = [
        {
            "date": date_obj.isoformat(),
            "forecast_income": round(income, 2),
            "forecast_expense": round(expense, 2),
            "forecast_balance": round(balance, 2)
        }
        for date_obj, income, expense, balance in zip(future_dates, forecast_flows[:, 0], forecast_flows[:, 1], forecast_balances)
    ]
    
    return {
        "summary": {
            "start_date": daily_summary["date"].iloc[-1].date().isoformat(),
            "start_balance": round(daily_summary["balance"].iloc[-1], 2),
            "end_date": future_dates[-1].isoformat(),
            "forecast_end_balance": forecast_final_balance,
            "forecast_total_income": forecast_total_income,
            "forecast_total_expense": forecast_total_expense,
            "net_flow_forecast": round(forecast_total_income - forecast_total_expense, 2),
            "model_notes": f"PyTorch LSTM based on {LOOKBACK}-day lookback and {EPOCHS} epochs."
        },
        "forecast_results": forecast_results
    }
