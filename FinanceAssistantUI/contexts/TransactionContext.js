// contexts/TransactionContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiRequest, apiUpload, setAuthToken } from '../services/apiClient';
import { useAuth } from './AuthContext';

const TransactionContext = createContext();

export const useTransactions = () => {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransactions must be used within a TransactionProvider');
  }
  return context;
};

// Helper: Get Icon (动态获取图标，支持自定义分类)
const getCategoryIcon = (categoryName, categoriesList = []) => {
  // 1. 尝试从自定义分类列表找
  if (categoriesList && categoriesList.length > 0) {
      const cat = categoriesList.find(c => c.name === categoryName);
      if (cat && cat.icon) return cat.icon;
  }
  
  // 2. 默认映射
  const icons = {
    'Food': 'food', 'Transport': 'car', 'Shopping': 'cart', 'Bills': 'file-document',
    'Entertainment': 'movie', 'Healthcare': 'hospital', 'Education': 'school',
    'Salary': 'cash', 'Freelance': 'laptop', 'Investment': 'chart-line',
    'Gift': 'gift', 'Bonus': 'star', 'Other': 'dots-horizontal', 'Savings': 'piggy-bank',
    'Travel': 'airplane', 'Vehicle': 'car', 'Housing': 'home'
  };
  return icons[categoryName] || 'tag';
};

// Helper: Get Color (动态获取颜色)
const getCategoryColor = (categoryName, categoriesList = []) => {
  if (categoriesList && categoriesList.length > 0) {
      const cat = categoriesList.find(c => c.name === categoryName);
      if (cat && cat.color) return cat.color;
  }
  const colors = {
      'Food': '#FF6B6B', 'Transport': '#4ECDC4', 'Shopping': '#45B7D1',
      'Bills': '#FFA07A', 'Entertainment': '#9B59B6', 'Housing': '#E67E22',
      'Vehicle': '#95A5A6', 'Travel': '#3498DB', 'Education': '#F1C40F',
      'Savings': '#FFD700', 'Other': '#808080'
  };
  return colors[categoryName] || '#808080';
};

export const TransactionProvider = ({ children }) => {
  const { isAuthenticated, idToken } = useAuth();
  
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState({});

  // === 1. 初始化加载 ===
  useEffect(() => {
    if (isAuthenticated && idToken) {
      setAuthToken(idToken);
      console.log("TransactionContext: Loading all user data...");
      
      loadAccounts();
      loadCategories();
      loadTransactions();
      loadGoals();
      loadBudgets();
    } else {
      // Logout cleanup
      setAccounts([]);
      setTransactions([]); 
      setBudgets([]);
      setGoals([]);
      setCategories([]);
    }
  }, [isAuthenticated, idToken]); 

  // === 2. API Actions ===

  // --- Accounts ---
  const loadAccounts = async () => {
    try {
      const data = await apiRequest('/accounts/');
      if (data && Array.isArray(data) && data.length > 0) {
        setAccounts(data);
      } else {
        await createDefaultAccount();
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const createDefaultAccount = async () => {
    try {
      const newAccount = await apiRequest('/accounts/', {
        method: 'POST',
        body: JSON.stringify({ name: "Cash" })
      });
      if (newAccount) setAccounts([newAccount]);
    } catch (error) {
      console.error('Error creating default account:', error);
    }
  };

  // --- Categories ---
  const loadCategories = async () => {
    try {
        const data = await apiRequest('/categories/');
        if (data && Array.isArray(data)) {
            setCategories(data);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
  };

  const addCategory = async (newCategory) => {
      try {
          const payload = {
              name: newCategory.name,
              type: newCategory.type === 'expense' ? 'Expense' : 'Income',
              icon: newCategory.icon,
              color: newCategory.color || "#" + Math.floor(Math.random()*16777215).toString(16)
          };
          const savedCategory = await apiRequest('/categories/', {
              method: 'POST',
              body: JSON.stringify(payload)
          });
          if (savedCategory) {
              await loadCategories();
              return true;
          }
      } catch (error) {
          console.error("Error adding category:", error);
          throw error;
      }
  };

  const deleteCategory = async (categoryId) => {
      try {
          await apiRequest(`/categories/${categoryId}`, { method: 'DELETE' });
          setCategories(prev => prev.filter(c => c.id !== categoryId));
          return true;
      } catch (error) {
          console.error("Error deleting category:", error);
          throw error;
      }
  };

  // --- Transactions ---
  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/transactions/');
      if (data && Array.isArray(data)) {
        const formattedTransactions = data.map(tx => ({
          id: tx.id,
          type: tx.type === 'Income' ? 'income' : 'expend',
          category: tx.category,
          amount: tx.amount,
          date: new Date(tx.transaction_date),
          time: tx.transaction_time || "00:00", 
          description: tx.merchant || 'Unknown',
          icon: getCategoryIcon(tx.category, categories) 
        }));
        setTransactions(formattedTransactions);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = async (transaction) => {
    if (accounts.length === 0) {
       console.error("No account found");
       return;
    }
    const accountId = accounts[0].id;
    const payload = {
      transaction_date: transaction.date.toISOString().split('T')[0],
      transaction_time: transaction.time || new Date().toTimeString().substring(0, 5), 
      type: transaction.type === 'income' ? 'Income' : 'Expense',
      amount: parseFloat(transaction.amount),
      category: transaction.category,
      merchant: transaction.description || 'Manual Entry',
      account_id: accountId
    };

    try {
      const savedTx = await apiRequest('/transactions/manual', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (savedTx) {
        const newTransaction = {
          id: savedTx.id, 
          type: transaction.type,
          category: transaction.category,
          amount: payload.amount,
          date: new Date(savedTx.transaction_date),
          time: transaction.time,
          description: savedTx.merchant,
          icon: getCategoryIcon(transaction.category, categories)
        };
        setTransactions(prev => [newTransaction, ...prev]);
        
        // 刷新预算状态
        if (transaction.type === 'expend') await loadBudgets();
      }
    } catch (error) {
      console.error("Failed to save transaction:", error);
      throw error;
    }
  };

  const updateTransaction = async (updatedTx) => {
    if (accounts.length === 0) return;
    const accountId = accounts[0].id;
    const payload = {
      transaction_date: updatedTx.date.toISOString().split('T')[0],
      type: updatedTx.type === 'income' ? 'Income' : 'Expense',
      amount: parseFloat(updatedTx.amount),
      category: updatedTx.category,
      merchant: updatedTx.description,
      account_id: accountId,
      transaction_time: updatedTx.time || "00:00"
    };

    // Optimistic Update
    const oldTransactions = [...transactions];
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    
    try {
      await apiRequest(`/transactions/${updatedTx.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (updatedTx.type === 'expend') await loadBudgets();
    } catch (error) {
      console.error("Failed to update transaction:", error);
      setTransactions(oldTransactions);
    }
  };

  const deleteTransaction = async (transactionId) => {
    const oldTransactions = [...transactions];
    const targetTx = transactions.find(t => t.id === transactionId);
    setTransactions(prev => prev.filter(t => t.id !== transactionId));
    
    try {
      await apiRequest(`/transactions/${transactionId}`, { method: 'DELETE' });
      if (targetTx && targetTx.type === 'expend') await loadBudgets();
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      setTransactions(oldTransactions);
    }
  };

  const uploadReceipt = async (fileUri, mimeType = 'image/jpeg') => {
    if (accounts.length === 0) await loadAccounts();
    if (accounts.length === 0) throw new Error("System initializing... try again.");
    const accountId = accounts[0].id;
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name: 'receipt.jpg', type: mimeType });

    try {
      setLoading(true);
      if (idToken) setAuthToken(idToken);
      const extractedTransactions = await apiUpload(`/transactions/vlm/extract/${accountId}`, formData);
      
      if (extractedTransactions && Array.isArray(extractedTransactions)) {
        const formattedTransactions = extractedTransactions.map(tx => ({
          id: tx.id,
          type: tx.type === 'Income' ? 'income' : 'expend',
          category: tx.category,
          amount: tx.amount,
          date: new Date(tx.transaction_date),
          description: tx.merchant || 'Unknown Merchant',
          icon: getCategoryIcon(tx.category, categories),
          time: new Date().toTimeString().substring(0, 5)
        }));
        setTransactions(prev => [...formattedTransactions, ...prev]);
        await loadBudgets(); // 刷新预算
        return formattedTransactions.length;
      }
      return 0;
    } catch (error) {
      console.error('VLM Upload Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // === 新增：加载日历事件 ===
  const loadCalendarEvents = async () => {
    try {
      const today = new Date();
      // 获取当前月份的日历数据
      // 注意：这里的 API 路径对应后端 calendar_router 的 /report
      const data = await apiRequest(`/calendar/report?month=${today.getMonth() + 1}&year=${today.getFullYear()}`);
      if (data) {
        setCalendarEvents(data);
      }
    } catch (error) {
      console.error('Error loading calendar events:', error);
    }
  };

  // --- Goals ---
  const loadGoals = async () => {
    try {
      const data = await apiRequest('/goals/goal');
      if (data && Array.isArray(data)) {
        const formattedGoals = data.map(g => ({
          id: g.id,
          title: g.name,
          targetAmount: g.target_amount,
          currentAmount: g.current_saved,
          deadline: g.target_date,
          category: "Savings",
          progress: g.target_amount > 0 ? (g.current_saved / g.target_amount) : 0,
          completed: g.current_saved >= g.target_amount,
          createdAt: new Date().toISOString() 
        }));
        setGoals(formattedGoals);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const addGoal = async (newGoal) => {
    try {
      const payload = {
        name: newGoal.title,
        target_amount: parseFloat(newGoal.targetAmount),
        target_date: newGoal.deadline,
        current_saved: parseFloat(newGoal.currentAmount) || 0
      };
      const savedGoal = await apiRequest('/goals/goal', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (savedGoal) {
        await loadGoals();
        if (payload.current_saved > 0) {
            await addTransaction({
                type: 'expend',
                amount: payload.current_saved,
                category: 'Savings',
                date: new Date(),
                time: new Date().toTimeString().substring(0, 5),
                description: `Initial deposit for Goal: ${payload.name}`
            });
        }
        return true;
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  };

  const deleteGoal = async (goalId) => {
      try {
          await apiRequest(`/goals/goal/${goalId}`, { method: 'DELETE' });
          setGoals(prev => prev.filter(g => g.id !== goalId));
          await loadTransactions(); // Refresh transactions (refunds)
          return true;
      } catch (error) {
          console.error("Error deleting goal:", error);
          throw error;
      }
  };

  const updateGoalProgress = async (goalId, amountToAdd) => {
     const goalIndex = goals.findIndex(g => g.id === goalId);
     if (goalIndex === -1) return;
     
     const oldGoals = [...goals];
     const targetGoal = goals[goalIndex];
     
     setGoals(prev => prev.map(g => {
         if (g.id === goalId) {
             const newAmount = Math.max(0, g.currentAmount + amountToAdd);
             return { 
                 ...g, 
                 currentAmount: newAmount, 
                 progress: g.targetAmount > 0 ? newAmount / g.targetAmount : 0,
                 completed: newAmount >= g.targetAmount
             };
         }
         return g;
     }));
     
     try {
         await apiRequest(`/goals/goal/${goalId}/progress`, {
             method: 'PUT',
             body: JSON.stringify({ amount_change: amountToAdd })
         });

         await addTransaction({
            type: amountToAdd > 0 ? 'expend' : 'income', 
            amount: Math.abs(amountToAdd),
            category: 'Savings',
            date: new Date(),
            time: new Date().toTimeString().substring(0, 5),
            description: `${amountToAdd > 0 ? 'Deposit to' : 'Withdraw from'} Goal: ${targetGoal.title}`
        });
        
     } catch (error) {
         console.error("Failed to update goal:", error);
         setGoals(oldGoals);
         alert("Failed to update goal.");
     }
  };

  // --- Budgets ---
  const loadBudgets = async () => {
    try {
      const data = await apiRequest('/goals/budget');
      if (data && Array.isArray(data)) {
        const formattedBudgets = data.map(b => ({
            id: b.id,
            category: b.category,
            // 适配新字段名
            allocated: b.limit_amount, 
            period: b.period || 'Monthly', // 默认值
            spent: b.current_spending,
            remaining: b.remaining_budget,
            color: getCategoryColor(b.category, categories),
            // 这里计算 Weekly Safe Limit: 如果是 Monthly，则 daily * 7；如果是 Weekly，直接用 remaining
            weeklySafeLimit: (b.period === 'Weekly') 
                ? Math.max(0, b.remaining_budget) 
                : Math.max(0, b.daily_spending_limit * 7),
            dailyLimit: b.daily_spending_limit // 保留原有的
        }));
        setBudgets(formattedBudgets);
      }
    } catch (error) {
      console.error('Error loading budgets:', error);
    }
  };

  const addBudget = async (newBudget) => {
    try {
        const payload = {
            name: newBudget.category + " Budget",
            category: newBudget.category,
            // 发送新字段
            limit_amount: parseFloat(newBudget.allocated),
            period: newBudget.period // "Monthly" or "Weekly"
        };
        
        const savedBudget = await apiRequest('/goals/budget', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (savedBudget) {
            await loadBudgets();
            return true;
        }
    } catch (error) {
        console.error('Error creating budget:', error);
        throw error;
    }
  };

  const updateBudget = async (budgetID, updatedData) => {
        try {
            const payload = {
                name: updatedData.category + " Budget",
                category: updatedData.category,
                limit_amount: parseFloat(updatedData.allocated),
                period: updatedData.period
            };

            await apiRequest(`/goals/budget/${budgetID}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            // 更新成功后重新加载预算，以重新计算剩余金额和进度
            await loadBudgets();
            return true;
        } catch (error) {
            console.error("Error updating budget:", error);
            throw error;
        }
    };

  // Delete Budget
  const deleteBudget = async (budgetId) => {
      try {
          await apiRequest(`/goals/budget/${budgetId}`, { method: 'DELETE' });
          // 本地更新
          setBudgets(prev => prev.filter(b => b.id !== budgetId));
          return true;
      } catch (error) {
          console.error("Error deleting budget:", error);
          throw error;
      }
  };

  // --- Getter Functions (Derived State) ---
  const getBudgetByCategory = (cat) => budgets.find(b => b.category === cat);

  const getTotalBudgetProgress = () => {
    const total = budgets.reduce((s, b) => s + (b.allocated || 0), 0);
    const spent = budgets.reduce((s, b) => s + (b.spent || 0), 0);
    return { totalBudget: total, totalSpent: spent, progress: total > 0 ? Math.min(spent / total, 1) : 0, remaining: Math.max(total - spent, 0) };
  };
  
  const getCurrentBalance = () => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expend = transactions.filter(t => t.type === 'expend').reduce((s, t) => s + t.amount, 0);
    return income - expend;
  };

  const getTransactionsByDateRange = (start, end) => transactions.filter(t => new Date(t.date) >= start && new Date(t.date) <= end);
  const getTransactionsByCategory = (cat) => transactions.filter(t => t.category === cat);
  
  const getMonthlySummary = (year, month) => {
    const monthly = transactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === year && d.getMonth() === month; });
    const income = monthly.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = monthly.filter(t => t.type === 'expend').reduce((s, t) => s + t.amount, 0);
    return { income, expenses, balance: income - expenses, transactionCount: monthly.length };
  };

  const getCategorySpending = () => {
    const map = {};
    transactions.filter(t => t.type === 'expend').forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([k, v]) => ({ category: k, amount: v })).sort((a, b) => b.amount - a.amount);
  };

  const getRecentTransactions = (days = 7) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return transactions.filter(t => new Date(t.date) >= cutoff);
  };

  const searchTransactions = (q) => {
    const lq = q.toLowerCase();
    return transactions.filter(t => t.description.toLowerCase().includes(lq) || t.category.toLowerCase().includes(lq) || t.amount.toString().includes(lq));
  };
  
  // Mock for compatibility
  const clearAllTransactions = () => {}; 
  const addGoalTransaction = () => {}; 

  const getIconForCategory = (catName) => getCategoryIcon(catName, categories);

  const value = {
    // State
    transactions, accounts, budgets, goals, categories, loading, calendarEvents,
    
    // Core Actions
    loadAccounts, uploadReceipt, addTransaction,

    // Calendar Actions
    loadCalendarEvents, 
    
    // Goal Actions
    loadGoals, addGoal, updateGoalProgress, deleteGoal,
    
    // Budget Actions
    loadBudgets, addBudget, updateBudget, deleteBudget, getBudgetByCategory, getTotalBudgetProgress,

    // Categories Actions
    loadCategories, addCategory, deleteCategory,
    
    // Helpers / Legacy
    updateTransaction, deleteTransaction, clearAllTransactions,
    addGoalTransaction, getCurrentBalance, getTransactionsByDateRange, getTransactionsByCategory,
    getMonthlySummary, getCategorySpending, getRecentTransactions, searchTransactions,
    getCategoryIcon: getIconForCategory
  };

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
};