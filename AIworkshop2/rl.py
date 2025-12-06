# AI workshop 2/rl.py
import numpy as np
import pandas as pd
import yfinance as yf
import datetime
from typing import Dict, List, Tuple, Optional, Any
import gymnasium as gym
from gymnasium import spaces
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from stable_baselines3.common.callbacks import BaseCallback
import torch
import os
import json 

DEVICE = "cpu"


TICKERS = {
    'Crypto': 'BTC-USD',      
    'Stocks': 'SPY',          
    'ETF': 'VTI',             
    'Retirement': 'AOM',      
    'RealEstate': 'VNQ',      
    'Gold': 'GLD',            
    'Bonds': 'BND'            
}
ASSET_NAMES = list(TICKERS.keys())
NUM_ASSETS = len(ASSET_NAMES)
HISTORICAL_YEARS = 5 
RL_TRAINING_STEPS = 50000 
TRADING_DAYS_PER_YEAR = 252
LOOKBACK_WINDOW = 60 
INITIAL_PORTFOLIO_VALUE = 10000.0
INITIAL_PORTFOLIO_VALUE_DEFAULT = 10000.0




def get_risk_aversion(latest_fhs: float) -> Tuple[float, str]:
    """Determines risk aversion factor and profile based on latest FHS score."""
    if latest_fhs >= 85:
        risk_aversion = 1.0 
        risk_profile = "Aggressive (FHS: Excellent)"
    elif latest_fhs >= 70:
        risk_aversion = 2.0 
        risk_profile = "Growth (FHS: Good)"
    elif latest_fhs >= 50:
        risk_aversion = 4.0 
        risk_profile = "Balanced (FHS: Average)"
    elif latest_fhs >= 30:
        risk_aversion = 6.0 
        risk_profile = "Conservative (FHS: Poor)"
    else:
        risk_aversion = 10.0 
        risk_profile = "Extremely Conservative (FHS: Very Poor)"

    return risk_aversion, risk_profile




class PortfolioOptimizationEnv(gym.Env):
    """Custom Environment for Portfolio Optimization using Reinforcement Learning"""
    
    metadata = {'render_modes': ['human']}
    
    def __init__(self, df: pd.DataFrame, risk_aversion: float = 4.0, lookback_window: int = 60, initial_portfolio_value: float = INITIAL_PORTFOLIO_VALUE_DEFAULT):
        super(PortfolioOptimizationEnv, self).__init__()
        
        self.df = df
        self.risk_aversion = risk_aversion
        self.lookback_window = lookback_window
        self.n_assets = len(df.columns)
        self.initial_portfolio_value = initial_portfolio_value
        
        self.action_space = spaces.Box(low=-1, high=1, shape=(self.n_assets,), dtype=np.float32)
        
        state_size = self.n_assets * (lookback_window) + self.n_assets
        self.observation_space = spaces.Box(
            low=-10, high=10, 
            shape=(state_size,), 
            dtype=np.float32
        )
        
    def _get_state(self):
        """Get current state including historical returns and current weights"""
        start_idx = self.current_step - self.lookback_window
        end_idx = self.current_step
        
        if start_idx < 0:
            padding_len = abs(start_idx)
            historical_returns = np.zeros((self.lookback_window, self.n_assets))
            historical_returns[padding_len:] = self.df.iloc[:end_idx].values
        else:
            historical_returns = self.df.iloc[start_idx:end_idx].values
        
        state = np.concatenate([
            historical_returns.flatten(),
            self.current_weights
        ])
        
        state = state.astype(np.float32)
        state = np.clip(state, -10, 10)
        
        return state
    
    def _normalize_action(self, action: np.ndarray) -> np.ndarray:
        """Convert symmetric actions [-1, 1] to valid portfolio weights [0, 1] that sum to 1"""
        weights = np.exp(np.clip(action, -10, 10))
        weights = weights / (np.sum(weights) + 1e-8)
        return weights
    
    def reset(self, seed: Optional[int] = None, options: Optional[dict] = None):
        """Reset the environment to initial state"""
        super().reset(seed=seed)
        
        self.current_step = self.lookback_window 
        self.portfolio_value = self.initial_portfolio_value
        self.current_weights = np.array([1.0 / self.n_assets] * self.n_assets, dtype=np.float32)
        
        self.portfolio_history = [self.portfolio_value]
        self.weights_history = [self.current_weights.copy()]
        self.returns_history = []
        
        info = {}
        state = self._get_state()
        return state, info
    
    def step(self, action):
        """Execute one time step in the environment"""
        action_weights = self._normalize_action(action)
        
        terminated = self.current_step >= len(self.df) - 1
        truncated = False
        
        if self.current_step >= len(self.df):
            state = self._get_state()
            return state, 0.0, terminated, truncated, {}
            
        current_returns = self.df.iloc[self.current_step].values.astype(np.float32)
        portfolio_return = np.sum(action_weights * current_returns)
        new_portfolio_value = self.portfolio_value * (1 + portfolio_return)
        
        
        recent_returns = self.returns_history[-min(20, len(self.returns_history)):] + [portfolio_return]
        portfolio_std = np.std(recent_returns)
        if portfolio_std < 1e-8:
            portfolio_std = 0.001 
            
        
        reward = portfolio_return * TRADING_DAYS_PER_YEAR - self.risk_aversion * 0.5 * (portfolio_std ** 2) * TRADING_DAYS_PER_YEAR
        
        self.current_weights = action_weights.astype(np.float32)
        self.portfolio_value = new_portfolio_value
        self.current_step += 1
        
        self.portfolio_history.append(self.portfolio_value)
        self.weights_history.append(self.current_weights.copy())
        self.returns_history.append(portfolio_return)
        
        info = {
            'portfolio_value': float(self.portfolio_value),
            'portfolio_return': float(portfolio_return),
            'weights': self.current_weights.tolist()
        }
        
        state = self._get_state()
        return state, float(reward), terminated, truncated, info
    
    def get_final_weights(self):
        """Get the optimized portfolio weights (average of the last 20% of episodes)"""
        if len(self.weights_history) > 0:
            stable_period = max(1, len(self.weights_history) // 5)
            final_weights = np.mean(self.weights_history[-stable_period:], axis=0)
            final_weights = final_weights / np.sum(final_weights)  
            return final_weights.astype(np.float32)
        else:
            return np.array([1.0 / self.n_assets] * self.n_assets, dtype=np.float32)



def fetch_asset_data(tickers: Dict) -> pd.DataFrame:
    """Fetch historical asset data (5 years) and calculate daily returns."""
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=HISTORICAL_YEARS * 365)
    
    print("Fetching historical asset data...")
    
    data = yf.download(list(tickers.values()), start=start_date, end=end_date, auto_adjust=True)
    
    if data.empty:
        raise ValueError("Failed to download asset data. Check tickers or date range.")
    
    if isinstance(data.columns, pd.MultiIndex):
        prices_df = data['Close']
    else:
        prices_df = data.copy()
        
    prices_df.columns = ASSET_NAMES
    prices_df = prices_df.dropna(axis=1) 
    prices_df = prices_df.fillna(method='ffill').fillna(method='bfill') 

    returns = prices_df.pct_change().dropna()
    
    if len(returns.columns) < 2:
        raise ValueError("Not enough valid asset data remaining after cleanup for optimization.")
        
    print(f"Data fetched for {len(returns)} trading days.")
    return returns

def train_rl_agent(returns_df: pd.DataFrame, risk_aversion: float, initial_portfolio_value: float) -> Tuple[PPO, np.ndarray, Dict]:
    """Train RL agent for portfolio optimization and return the model, weights, and evaluation."""
    
    print("\n🚀 Training RL Portfolio Optimizer...")
    
    env = PortfolioOptimizationEnv(returns_df, risk_aversion, LOOKBACK_WINDOW, initial_portfolio_value)
    
    try:
        check_env(env, warn=False)
    except Exception as e:
        print(f"⚠️ Environment check warning: {e}. Continuing with training.")
    
    model = PPO(
        "MlpPolicy",
        env,
        learning_rate=3e-4,
        n_steps=1024, 
        batch_size=64,
        gamma=0.99,
        clip_range=0.2,
        verbose=0,
        device=DEVICE
    )
    
    print(f"Training for {RL_TRAINING_STEPS} steps...")
    model.learn(total_timesteps=RL_TRAINING_STEPS)
    
    obs, _ = env.reset()
    done = False
    
    while not done:
        action, _states = model.predict(obs, deterministic=True)
        obs, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated

    final_weights = env.get_final_weights()
    
    trading_days = len(env.returns_history)
    total_return = (env.portfolio_value - INITIAL_PORTFOLIO_VALUE) / INITIAL_PORTFOLIO_VALUE
    annual_return = (1 + total_return) ** (TRADING_DAYS_PER_YEAR / trading_days) - 1 if trading_days > 0 else 0
    volatility = np.std(env.returns_history) * np.sqrt(TRADING_DAYS_PER_YEAR) if env.returns_history else 0
    sharpe_ratio = annual_return / volatility if volatility > 0 else 0
    
    rl_results = {
        'total_return': float(total_return),
        'annual_return': float(annual_return),
        'volatility': float(volatility),
        'sharpe_ratio': float(sharpe_ratio),
        'final_value': float(env.portfolio_value),
        'portfolio_history': [float(x) for x in env.portfolio_history]
    }
    
    print("✅ RL Training Completed!")
    return model, final_weights, rl_results

def run_monte_carlo(optimized_weights: np.ndarray, returns_df: pd.DataFrame, monthly_contribution: float, num_simulations: int = 100) -> Dict:
    """Run Monte Carlo simulation using RL-optimized weights for 5, 10, 25 years."""
    
    time_horizons = [5, 10, 25]
    print(f"\n--- Running {num_simulations} Monte Carlo Simulations ---")
    
    portfolio_returns = (returns_df * optimized_weights).sum(axis=1)
    daily_return = portfolio_returns.mean()
    daily_volatility = portfolio_returns.std()
    
    mc_results = {}
    
    for horizon in time_horizons:
        num_trading_days = horizon * TRADING_DAYS_PER_YEAR
        final_values = []
        
        for sim in range(num_simulations):
            current_value = 0.0
            
            for day in range(num_trading_days):
                if day % 21 == 0: 
                    current_value += monthly_contribution
                
                stochastic_return = np.random.normal(loc=daily_return, scale=daily_volatility)
                current_value *= (1 + stochastic_return)
            
            final_values.append(current_value)
            
        mc_results[f'{horizon}yr'] = {
            'mean_value': round(np.mean(final_values), 2),
            'p5_low': round(np.percentile(final_values, 5), 2),
            'p95_high': round(np.percentile(final_values, 95), 2),
        }
        print(f"Projected Mean Portfolio Value ({horizon} Years): ${mc_results[f'{horizon}yr']['mean_value']:,.2f}")
        
    return mc_results


def generate_rl_optimization_report(
    latest_fhs: float, 
    starting_balance: float, 
    monthly_contribution: float, 
    returns_df: pd.DataFrame
) -> Dict[str, Any]:
    """
    Main function to execute the RL portfolio optimization pipeline.
    
    :param latest_fhs: The most recent Financial Health Score for personalization.
    :param starting_balance: The user's actual initial investment amount.
    :param monthly_contribution: The investable cash flow from LSTM forecast.
    :param returns_df: The DataFrame of asset returns.
    :return: A dictionary containing the optimized weights, performance, and Monte Carlo forecast.
    """
    try:
        risk_aversion, risk_profile = get_risk_aversion(latest_fhs)
        
        
        model, final_weights_raw, rl_performance = train_rl_agent(returns_df, risk_aversion, starting_balance)
        
        optimized_weights = {
            asset: round(weight * 100, 2)
            for asset, weight in zip(ASSET_NAMES, final_weights_raw)
        }
        
        mc_forecast = run_monte_carlo(final_weights_raw, returns_df, monthly_contribution)
        
        report = {
            "personalization": {
                "latest_fhs": latest_fhs,
                "risk_profile": risk_profile,
                "starting_balance": starting_balance, # ADDED TO REPORT
                "monthly_contribution": monthly_contribution
            },
            "rl_performance": {
                "annual_return_pct": round(rl_performance['annual_return'] * 100, 2),
                "annual_volatility_pct": round(rl_performance['volatility'] * 100, 2),
                "sharpe_ratio": round(rl_performance['sharpe_ratio'], 2),
                "final_value_history": rl_performance['portfolio_history']
            },
            "optimized_weights": optimized_weights,
            "mc_forecast": mc_forecast
        }
        
        return report

    except ValueError as e:
        return {"error": str(e)}
    except Exception as e:
        print(f"RL Report Generation Error: {e}")
        return {"error": f"An unexpected error occurred during RL optimization: {str(e)}"}