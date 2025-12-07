// screens/DashboardScreen.js
import React, { useState, useMemo, useEffect } from "react";
import { 
  ScrollView, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions,
  RefreshControl,
  Modal
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTransactions } from "../contexts/TransactionContext";
import ProgressBar from "../components/ProgressBar";
import SummaryCard from "../components/SummaryCard";
import { apiRequest } from "../services/apiClient";

const { width, height } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { 
    transactions, 
    budgets = [], 
    calendarEvents = {}, 
    loadTransactions, 
    loadBudgets, 
    loadCalendarEvents 
  } = useTransactions();

  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('month');
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState('income');
  
  // === Twin Data State ===
  const [twinData, setTwinData] = useState(null);
  const loadTwinData = async () => {
    try {
      const data = await apiRequest('/twin/dashboard');
      if (data) setTwinData(data);
    } catch (e) { console.log("Twin Load Error:", e); }
  };

  useEffect(() => {
    loadCalendarEvents();
    loadTwinData();
  }, []);

  const upcomingBills = useMemo(() => {
    if (!calendarEvents || Object.keys(calendarEvents).length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const bills = [];

    Object.keys(calendarEvents).forEach(dateStr => {
      const eventDate = new Date(dateStr);
      if (eventDate >= today && eventDate <= nextWeek) {
        const dayEvents = calendarEvents[dateStr];
        dayEvents.forEach(event => {
          if (event.type === 'Bill Due' || event.type === 'User Bill') {
            const diffTime = Math.abs(eventDate - today);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            bills.push({
              ...event,
              date: eventDate,
              daysLeft: diffDays,
              displayDate: eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
          }
        });
      }
    });

    return bills.sort((a, b) => a.date - b.date).slice(0, 3); 
  }, [calendarEvents]);


  // === 1. Calculate financial metrics (Income, Expense, Savings) ===
  const financialData = useMemo(() => {
    const currentDate = new Date();
    currentDate.setHours(23, 59, 59, 999); 
    
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const safeTransactions = Array.isArray(transactions) ? transactions : [];

    switch (timeRange) {
      case 'week':
        startDate.setDate(currentDate.getDate() - 6); 
        break;
      case 'month':
        startDate.setDate(1); 
        break;
      case 'year':
        startDate.setMonth(0, 1); 
        break;
      default:
        startDate.setDate(1);
    }

    const filteredTransactions = safeTransactions.filter(t => {
        if (!t.date) return false;
        const tDate = new Date(t.date);
        return tDate >= startDate && tDate <= currentDate;
    });

    const income = filteredTransactions
      .filter(t => t.type === 'income' || t.type === 'Income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const expenses = filteredTransactions
      .filter(t => t.type === 'expend' || t.type === 'Expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    const categorySpending = filteredTransactions
      .filter(t => t.type === 'expend' || t.type === 'Expense')
      .reduce((acc, transaction) => {
        if (transaction && transaction.category) {
          const { category, amount } = transaction;
          acc[category] = (acc[category] || 0) + (amount || 0);
        }
        return acc;
      }, {});

    const categoryIncome = filteredTransactions
      .filter(t => t.type === 'income' || t.type === 'Income')
      .reduce((acc, transaction) => {
        if (transaction && transaction.category) {
          const { category, amount } = transaction;
          acc[category] = (acc[category] || 0) + (amount || 0);
        }
        return acc;
      }, {});

    const topSpendingCategories = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    const topIncomeCategories = Object.entries(categoryIncome)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    return {
      income,
      expenses,
      savings,
      savingsRate,
      topSpendingCategories,
      topIncomeCategories,
      transactionCount: filteredTransactions.length
    };
  }, [transactions, timeRange]);

  // === 2. Budget progress calculation ===
  const budgetProgress = useMemo(() => {
    const safeBudgets = Array.isArray(budgets) ? budgets : [];
    
    let totalBudget = safeBudgets.reduce((sum, b) => sum + (b.allocated || 0), 0);
    
    if (timeRange === 'week') {
        totalBudget = totalBudget / 4.3; 
    } else if (timeRange === 'year') {
        totalBudget = totalBudget * 12;
    }

    const totalSpent = financialData.expenses;
    const progress = totalBudget > 0 ? (totalSpent / totalBudget) : 0;

    return {
      spent: totalSpent,
      budget: totalBudget,
      progress: Math.min(progress, 1),
      remaining: Math.max(totalBudget - totalSpent, 0)
    };
  }, [budgets, financialData, timeRange]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
        loadTransactions(), 
        loadBudgets(),
        loadCalendarEvents(), 
        loadTwinData()        
    ]);
    setRefreshing(false);
  };

  const getCategoryIcon = (category) => {
    return 'cash'; 
  };

  const formatAmount = (amount) => {
    return `RM ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getBarWidth = (amount, maxAmount) => {
    if (maxAmount === 0) return 0;
    return Math.max((amount / maxAmount) * 100, 10);
  };

   const recentTransactions = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    
    return [...transactions]
      .filter(t => t !== null && t !== undefined)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
  }, [transactions]);

  const maxSpending = financialData.topSpendingCategories.length > 0 
    ? Math.max(...financialData.topSpendingCategories.map(item => item.amount))
    : 0;
  
  const maxIncome = financialData.topIncomeCategories.length > 0 
    ? Math.max(...financialData.topIncomeCategories.map(item => item.amount))
    : 0;

  const chartData = {
    income: financialData.topIncomeCategories.map((item, index) => ({
      ...item,
      percentage: financialData.income > 0 ? (item.amount / financialData.income) * 100 : 0,
      color: ['#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9'][index] || '#4CAF50'
    })),
    spending: financialData.topSpendingCategories.map((item, index) => ({
      ...item,
      percentage: financialData.expenses > 0 ? (item.amount / financialData.expenses) * 100 : 0,
      color: ['#F44336', '#EF5350', '#E57373', '#EF9A9A', '#FFCDD2'][index] || '#F44336'
    }))
  };

  const openChartModal = (type) => {
    setSelectedChartType(type);
    setChartModalVisible(true);
  };

  const renderPieChart = (data, totalAmount) => {
    if (data.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <MaterialCommunityIcons name="chart-pie" size={64} color={colors.onSurface} style={{ opacity: 0.3 }} />
          <Text style={[styles.emptyChartText, { color: colors.onSurface }]}>No data available</Text>
        </View>
      );
    }

    let currentAngle = 0;
    const segments = data.map((item, index) => {
      const segmentAngle = (item.amount / totalAmount) * 360;
      const segment = {
        ...item,
        startAngle: currentAngle,
        endAngle: currentAngle + segmentAngle
      };
      currentAngle += segmentAngle;
      return segment;
    });

    return (
      <View style={styles.pieChartContainer}>
        <View style={styles.pieChart}>
          {segments.map((segment, index) => (
            <View
              key={segment.category}
              style={[
                styles.pieSegment,
                {
                  backgroundColor: segment.color,
                  transform: [
                    { rotate: `${segment.startAngle}deg` }
                  ],
                }
              ]}
            />
          ))}
        </View>
        <View style={styles.chartCenter}>
          <Text style={[styles.chartTotal, { color: colors.onSurface }]}>
            {formatAmount(totalAmount)}
          </Text>
          <Text style={[styles.chartLabel, { color: colors.onSurface }]}>
            Total {selectedChartType === 'income' ? 'Income' : 'Spending'}
          </Text>
        </View>
      </View>
    );
  };

  const renderBarChart = (data, maxAmount) => {
    if (data.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <MaterialCommunityIcons name="chart-bar" size={64} color={colors.onSurface} style={{ opacity: 0.3 }} />
          <Text style={[styles.emptyChartText, { color: colors.onSurface }]}>No data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.barChartContainer}>
        {data.map((item, index) => (
          <View key={item.category} style={styles.barChartItem}>
            <View style={styles.barLabelRow}>
              <View style={styles.barLabelLeft}>
                <View style={[styles.barColorIndicator, { backgroundColor: item.color }]} />
                <Text style={[styles.barCategory, { color: colors.onSurface }]} numberOfLines={1}>
                  {item.category}
                </Text>
              </View>
              <Text style={[styles.barAmount, { color: colors.onSurface }]}>
                {formatAmount(item.amount)}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View 
                style={[
                  styles.barFill,
                  { 
                    width: `${getBarWidth(item.amount, maxAmount)}%`,
                    backgroundColor: item.color
                  }
                ]} 
              />
            </View>
            <Text style={[styles.barPercentage, { color: colors.onSurface }]}>
              {item.percentage.toFixed(1)}%
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section */}
        <LinearGradient colors={["#7e92edff", "#84aae7ff"]} style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome Back!</Text>
              <Text style={styles.subtitle}>Here's your financial overview</Text>
            </View>
            
            {/* Time Range Selector */}
            <View style={styles.timeRangeSelector}>
              {[
                { key: 'week', label: 'Week' },
                { key: 'month', label: 'Month' },
                { key: 'year', label: 'Year' }
              ].map((range) => (
                <TouchableOpacity
                  key={range.key}
                  style={[
                    styles.timeRangeButton,
                    timeRange === range.key && styles.timeRangeButtonActive
                  ]}
                  onPress={() => setTimeRange(range.key)}
                >
                  <Text style={[
                    styles.timeRangeText,
                    timeRange === range.key && styles.timeRangeTextActive
                  ]}>
                    {range.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </LinearGradient>

        {/* Quick Stats Section */}
        <View style={styles.quickStatsSection}>
          <View style={styles.statsRow}>
            <SummaryCard
              title="Total Income"
              value={formatAmount(financialData.income)}
              trend="+12%"
              type="income"
            />
            <SummaryCard
              title="Total Expenses"
              value={formatAmount(financialData.expenses)}
              trend="-5%"
              type="expense"
            />
          </View>
          
          <View style={styles.statsRow}>
            <SummaryCard
              title="Net Savings"
              value={formatAmount(financialData.savings)}
              trend={financialData.savingsRate >= 0 ? `+${financialData.savingsRate.toFixed(1)}%` : `${financialData.savingsRate.toFixed(1)}%`}
              type="savings"
            />
            <SummaryCard
              title="Transactions"
              value={financialData.transactionCount.toString()}
              icon="swap-horizontal"
            />
          </View>
        </View>

        {/* === Twin Battle Card === */}
        {twinData && (
          <TouchableOpacity 
            style={[styles.section, { padding: 0, overflow: 'hidden' }]} 
            onPress={() => navigation.navigate('Twin')}
          >
            <LinearGradient
                colors={['#6A11CB', '#2575FC']} 
                start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                style={{ padding: 20 }}
            >
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <View style={{flex: 1}}>
                        <Text style={{color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold', marginBottom: 4}}>FINANCIAL BATTLE</Text>
                        <Text style={{color: 'white', fontSize: 16, fontWeight: 'bold'}}>
                            {twinData.battle_status.includes("Winning") || twinData.battle_status.includes("UNSTOPPABLE") 
                                ? "🏆 You are winning!" 
                                : "⚔️ Keep pushing!"}
                        </Text>
                        <Text style={{color: 'white', fontSize: 12, opacity: 0.8, marginTop: 4}}>
                            Vs. {twinData.easy_twin.savings < twinData.user_stats.savings ? "Easy Twin" : "Twins"}
                        </Text>
                    </View>
                    
                    <View style={{alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12}}>
                        <Text style={{color: 'white', fontSize: 10, fontWeight: 'bold'}}>LEVEL</Text>
                        <Text style={{color: '#FFD700', fontSize: 24, fontWeight: 'bold'}}>{twinData.gamification_profile.level}</Text>
                    </View>
                </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* === Upcoming Bills Section === */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="calendar-clock" size={24} color="#FFA726" />
              <Text style={[styles.sectionTitle, { color: colors.onSurface, marginLeft: 8 }]}>
                Upcoming Bills
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Calendar')}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>

          {upcomingBills.length > 0 ? (
            upcomingBills.map((bill, index) => (
              <View key={index} style={styles.billItem}>
                <View style={styles.billIconContainer}>
                  <View style={[styles.billIcon, { backgroundColor: '#FFF3E0' }]}>
                    <MaterialCommunityIcons name="file-document-outline" size={20} color="#FFA726" />
                  </View>
                  <View style={styles.billDetails}>
                    <Text style={[styles.billName, { color: colors.onSurface }]}>{bill.name}</Text>
                    <Text style={[styles.billDate, { color: colors.onSurface, opacity: 0.6 }]}>
                      Due {bill.daysLeft === 0 ? 'Today' : bill.daysLeft === 1 ? 'Tomorrow' : `in ${bill.daysLeft} days`} ({bill.displayDate})
                    </Text>
                  </View>
                </View>
                <Text style={[styles.billAmount, { color: '#F44336' }]}>
                  {formatAmount(bill.amount)}
                </Text>
              </View>
            ))
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <MaterialCommunityIcons name="check-circle-outline" size={40} color={colors.onSurface} style={{ opacity: 0.2, marginBottom: 8 }} />
              <Text style={{ color: colors.onSurface, opacity: 0.6, fontSize: 14 }}>
                No bills due in the next 7 days.
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Calendar')}>
                 <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                    Check Calendar
                 </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Budget Progress Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              Budget Overview ({timeRange === 'week' ? 'Weekly Est.' : timeRange === 'year' ? 'Yearly Est.' : 'Monthly'})
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Budget')}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>Manage</Text>
            </TouchableOpacity>
          </View>

          {budgets && budgets.length > 0 ? (
            <View style={styles.budgetContent}>
              <View style={styles.budgetSummary}>
                <View style={styles.budgetItem}>
                  <Text style={[styles.budgetLabel, { color: colors.onSurface }]}>Total Budget</Text>
                  <Text style={[styles.budgetAmount, { color: colors.primary }]}>{formatAmount(budgetProgress.budget)}</Text>
                </View>
                <View style={styles.budgetItem}>
                  <Text style={[styles.budgetLabel, { color: colors.onSurface }]}>Spent</Text>
                  <Text style={[styles.budgetAmount, { color: '#F44336' }]}>{formatAmount(budgetProgress.spent)}</Text>
                </View>
                <View style={styles.budgetItem}>
                  <Text style={[styles.budgetLabel, { color: colors.onSurface }]}>Remaining</Text>
                  <Text style={[styles.budgetAmount, { color: '#4CAF50' }]}>{formatAmount(budgetProgress.remaining)}</Text>
                </View>
              </View>

              <ProgressBar 
                progress={budgetProgress.progress}
                showPercentage={true}
                variant={budgetProgress.progress > 0.8 ? "danger" : budgetProgress.progress > 0.6 ? "warning" : "primary"}
              />
            </View>
          ) : (
            <View style={styles.emptyBudget}>
              <MaterialCommunityIcons name="chart-line" size={48} color={colors.onSurface} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyBudgetText, { color: colors.onSurface }]}>No budgets set yet</Text>
              <TouchableOpacity style={[styles.setBudgetButton, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('Budget')}>
                <Text style={[styles.setBudgetButtonText, { color: colors.surface }]}>Set Up Budgets</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Interactive Income Chart Section */}
        <TouchableOpacity 
          style={[styles.section, { backgroundColor: colors.surface }]}
          onPress={() => openChartModal('income')}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="chart-pie" size={24} color="#4CAF50" />
              <Text style={[styles.sectionTitle, { color: colors.onSurface, marginLeft: 8 }]}>Income Distribution</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
          </View>

          {financialData.topIncomeCategories.length > 0 ? (
            <View style={styles.miniChartContainer}>
              <View style={styles.miniPieChart}>
                {chartData.income.map((item, index) => {
                  const segmentAngle = (item.amount / financialData.income) * 360;
                  return (
                    <View
                      key={item.category}
                      style={[
                        styles.miniPieSegment,
                        {
                          backgroundColor: item.color,
                          transform: [{ rotate: `${index === 0 ? 0 : chartData.income.slice(0, index).reduce((sum, i) => sum + (i.amount / financialData.income) * 360, 0)}deg` }],
                        }
                      ]}
                    />
                  );
                })}
              </View>
              <View style={styles.miniChartLegend}>
                {chartData.income.slice(0, 3).map((item, index) => (
                  <View key={item.category} style={styles.miniLegendItem}>
                    <View style={[styles.miniColorDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.miniLegendText, { color: colors.onSurface }]} numberOfLines={1}>
                      {item.category} ({item.percentage.toFixed(1)}%)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="cash-plus" size={48} color={colors.onSurface} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyStateText, { color: colors.onSurface }]}>No income data available</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Interactive Spending Chart Section */}
        <TouchableOpacity 
          style={[styles.section, { backgroundColor: colors.surface }]}
          onPress={() => openChartModal('spending')}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="chart-bar" size={24} color="#F44336" />
              <Text style={[styles.sectionTitle, { color: colors.onSurface, marginLeft: 8 }]}>Spending Distribution</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
          </View>

          {financialData.topSpendingCategories.length > 0 ? (
            <View style={styles.miniBarChartContainer}>
              {chartData.spending.slice(0, 3).map((item, index) => (
                <View key={item.category} style={styles.miniBarItem}>
                  <View style={styles.miniBarInfo}>
                    <View style={[styles.miniColorDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.miniBarCategory, { color: colors.onSurface }]} numberOfLines={1}>{item.category}</Text>
                  </View>
                  <View style={styles.miniBarTrack}>
                    <View style={[styles.miniBarFill, { width: `${getBarWidth(item.amount, maxSpending)}%`, backgroundColor: item.color }]} />
                  </View>
                  <Text style={[styles.miniBarPercentage, { color: colors.onSurface }]}>{item.percentage.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="shopping" size={48} color={colors.onSurface} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyStateText, { color: colors.onSurface }]}>No spending data available</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Recent Activity */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length > 0 ? (
            recentTransactions.map((transaction) => (
              <View key={transaction.id} style={styles.recentItem}>
                <View style={[styles.recentIcon, { backgroundColor: (transaction.type === 'income' || transaction.type === 'Income') ? '#E8F5E8' : '#FFEBEE' }]}>
                  <MaterialCommunityIcons name="cash" size={18} color={(transaction.type === 'income' || transaction.type === 'Income') ? '#4CAF50' : '#F44336'} />
                </View>
                <View style={styles.recentDetails}>
                  <Text style={[styles.recentCategory, { color: colors.onSurface }]}>{transaction.category}</Text>
                  <Text style={[styles.recentDescription, { color: colors.onSurface }]}>{transaction.description}</Text>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={[styles.recentAmount, { color: (transaction.type === 'income' || transaction.type === 'Income') ? '#4CAF50' : '#F44336' }]}>
                    {(transaction.type === 'income' || transaction.type === 'Income') ? '+' : '-'}{formatAmount(transaction.amount)}
                  </Text>
                  <Text style={[styles.recentTime, { color: colors.onSurface }]}>{transaction.time}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.onSurface} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyStateText, { color: colors.onSurface }]}>No recent transactions</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Chart Modal */}
      <Modal
        visible={chartModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChartModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setChartModalVisible(false)}>
              <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
              {selectedChartType === 'income' ? 'Income Distribution' : 'Spending Distribution'}
            </Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.chartSection}>
              <Text style={[styles.chartSectionTitle, { color: colors.onSurface }]}>Pie Chart</Text>
              {renderPieChart(chartData[selectedChartType], selectedChartType === 'income' ? financialData.income : financialData.expenses)}
            </View>
            <View style={styles.chartSection}>
              <Text style={[styles.chartSectionTitle, { color: colors.onSurface }]}>Detailed Breakdown</Text>
              {renderBarChart(chartData[selectedChartType], selectedChartType === 'income' ? maxIncome : maxSpending)}
            </View>
            <View style={styles.legendSection}>
              <Text style={[styles.legendTitle, { color: colors.onSurface }]}>Categories</Text>
              {chartData[selectedChartType].map((item) => (
                <View key={item.category} style={styles.legendItem}>
                  <View style={styles.legendLeft}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={[styles.legendCategory, { color: colors.onSurface }]}>{item.category}</Text>
                  </View>
                  <View style={styles.legendRight}>
                    <Text style={[styles.legendAmount, { color: colors.onSurface }]}>{formatAmount(item.amount)}</Text>
                    <Text style={[styles.legendPercentage, { color: colors.onSurface }]}>{item.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.modalBottomPadding} />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: { paddingTop: 40, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerContent: { alignItems: 'center' },
  welcomeSection: { alignItems: 'center', marginBottom: 20 },
  welcomeText: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  timeRangeSelector: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 25, padding: 4 },
  timeRangeButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  timeRangeButtonActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  timeRangeText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  timeRangeTextActive: { color: '#fff' },
  quickStatsSection: { padding: 16, marginTop: -40 },
  statsRow: { flexDirection: 'row', marginBottom: 12 },
  section: { margin: 16, padding: 20, borderRadius: 20, elevation: 6, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, minHeight: 32 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', flexShrink: 1 },
  seeAllText: { fontSize: 14, fontWeight: '600' },
  chartAction: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  budgetContent: { marginTop: 8 },
  budgetSummary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  budgetItem: { alignItems: 'center' },
  budgetLabel: { fontSize: 12, opacity: 0.7, marginBottom: 4 },
  budgetAmount: { fontSize: 14, fontWeight: 'bold' },
  emptyBudget: { alignItems: 'center', padding: 20 },
  emptyBudgetText: { fontSize: 14, marginTop: 8, marginBottom: 12, textAlign: 'center' },
  setBudgetButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  setBudgetButtonText: { fontSize: 14, fontWeight: '600' },
  miniChartContainer: { flexDirection: 'row', alignItems: 'center' },
  miniPieChart: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f5f5f5', overflow: 'hidden', position: 'relative' },
  miniPieSegment: { position: 'absolute', width: '100%', height: '100%', borderRadius: 40 },
  miniChartLegend: { flex: 1, marginLeft: 16 },
  miniLegendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  miniColorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  miniLegendText: { fontSize: 12, flex: 1 },
  miniBarChartContainer: { gap: 12 },
  miniBarItem: { flexDirection: 'row', alignItems: 'center' },
  miniBarInfo: { flexDirection: 'row', alignItems: 'center', width: 80 },
  miniBarCategory: { fontSize: 12, marginLeft: 8, flex: 1 },
  miniBarTrack: { flex: 1, height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, marginHorizontal: 12, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 3 },
  miniBarPercentage: { fontSize: 12, width: 40, textAlign: 'right' },
  moreBarsIndicator: { alignItems: 'center', paddingVertical: 8 },
  moreItemsText: { fontSize: 12, fontStyle: 'italic' },
  recentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  recentIcon: { padding: 8, borderRadius: 10, marginRight: 12 },
  recentDetails: { flex: 1 },
  recentCategory: { fontSize: 14, fontWeight: '600' },
  recentDescription: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  amountContainer: { alignItems: 'flex-end' },
  recentAmount: { fontSize: 14, fontWeight: 'bold' },
  recentTime: { fontSize: 10, opacity: 0.7, marginTop: 2 },
  emptyState: { alignItems: 'center', padding: 20 },
  emptyStateText: { fontSize: 14, marginTop: 8, textAlign: 'center', opacity: 0.7 },
  bottomPadding: { height: 20 },
  modalContainer: { flex: 1, paddingTop: 11 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
  modalCloseButton: { padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', flex: 1, marginHorizontal: 12 },
  placeholder: { width: 32 },
  modalContent: { flex: 1 },
  modalScrollContent: { padding: 20, paddingBottom: 40 },
  chartSection: { marginBottom: 30 },
  chartSectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  pieChartContainer: { alignItems: 'center', justifyContent: 'center', height: 200, marginBottom: 20 },
  pieChart: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#f5f5f5', overflow: 'hidden', position: 'relative' },
  pieSegment: { position: 'absolute', width: '100%', height: '100%', borderRadius: 75 },
  chartCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  chartTotal: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  chartLabel: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  barChartContainer: { gap: 16 },
  barChartItem: { gap: 8 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabelLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  barColorIndicator: { width: 16, height: 16, borderRadius: 8, marginRight: 12 },
  barCategory: { fontSize: 14, fontWeight: '600', flex: 1 },
  barAmount: { fontSize: 14, fontWeight: 'bold' },
  barTrack: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barPercentage: { fontSize: 12, textAlign: 'right' },
  emptyChart: { alignItems: 'center', justifyContent: 'center', height: 120 },
  emptyChartText: { fontSize: 14, marginTop: 8, textAlign: 'center', opacity: 0.7 },
  legendSection: { marginTop: 20 },
  legendTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  legendItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  legendLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  legendColor: { width: 16, height: 16, borderRadius: 8, marginRight: 12 },
  legendCategory: { fontSize: 14, fontWeight: '600', flex: 1 },
  legendRight: { alignItems: 'flex-end' },
  legendAmount: { fontSize: 14, fontWeight: 'bold' },
  legendPercentage: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  modalBottomPadding: { height: 20 },
  
  // === Bill Item  ===
  billItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  billIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billIcon: {
    padding: 8,
    borderRadius: 10,
    marginRight: 12,
  },
  billDetails: {
    justifyContent: 'center',
  },
  billName: {
    fontSize: 14,
    fontWeight: '600',
  },
  billDate: {
    fontSize: 12,
    marginTop: 2,
  },
  billAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});