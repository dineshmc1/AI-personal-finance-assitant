import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Dimensions
} from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiRequest } from "../services/apiClient";
import ProgressBar from "../components/ProgressBar";

const { width } = Dimensions.get('window');

export default function ReportsScreen({ navigation }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const loadOptimizationReport = async () => {
    try {
      setError(null);
      // Fetch data from your backend RL endpoint
      const data = await apiRequest('/reports/optimization/rl');
      
      if (data) {
        setReportData(data);
      }
    } catch (err) {
      console.error("Optimization Report Error:", err);
      // Handle the specific error message from backend
      const msg = err.message || "Failed to load optimization report.";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOptimizationReport();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadOptimizationReport();
  };

  const renderAllocationItem = (asset, percentage, color) => (
    <View key={asset} style={styles.allocationItem}>
      <View style={styles.allocationHeader}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.assetName, { color: colors.onSurface }]}>{asset}</Text>
        </View>
        <Text style={[styles.assetPercent, { color: colors.onSurface }]}>{percentage}%</Text>
      </View>
      <ProgressBar progress={percentage / 100} color={color} />
    </View>
  );

  // Helper to generate distinct colors for charts
  const getChartColor = (index) => {
    const palette = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4', '#FFC107'];
    return palette[index % palette.length];
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 15, color: colors.onSurface }}>AI is optimizing your portfolio...</Text>
        <Text style={{ fontSize: 12, color: colors.onSurface, opacity: 0.6, marginTop: 5 }}>This involves training an RL model, please wait.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { padding: 20 }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={50} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.onSurface }]}>Optimization Failed</Text>
        <Text style={{ textAlign: 'center', marginVertical: 10, color: colors.onSurface, opacity: 0.7 }}>
          {error}
        </Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => { setLoading(true); loadOptimizationReport(); }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry Analysis</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!reportData) return null;

  const { personalization, optimized_weights, rl_performance, mc_forecast } = reportData;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={["#1E88E5", "#1565C0"]} style={styles.header}>
            <View style={styles.headerContent}>
                <View>
                    <Text style={styles.headerTitle}>AI Portfolio Optimization</Text>
                    <Text style={styles.headerSubtitle}>Reinforcement Learning (PPO) Model</Text>
                </View>
                <MaterialCommunityIcons name="brain" size={32} color="white" style={{opacity: 0.8}} />
            </View>
        </LinearGradient>

        <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        >
            {/* 1. Personalization Summary */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Your Profile Analysis</Text>
                <View style={styles.row}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>FHS Score</Text>
                        <Text style={[styles.statValue, { color: colors.primary }]}>{personalization.latest_fhs}</Text>
                    </View>
                    <View style={[styles.statItem, { flex: 2 }]}>
                        <Text style={styles.statLabel}>Risk Profile</Text>
                        <Text style={[styles.statValue, { color: colors.primary }]}>{personalization.risk_profile}</Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.row}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Current Balance</Text>
                        <Text style={[styles.statValue, { color: '#4CAF50' }]}>RM {personalization.starting_balance.toLocaleString()}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Monthly Contribution</Text>
                        <Text style={[styles.statValue, { color: '#2196F3' }]}>RM {personalization.monthly_contribution.toLocaleString()}</Text>
                    </View>
                </View>
            </View>

            {/* 2. Optimized Portfolio Allocation */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>AI Recommended Allocation</Text>
                <Text style={styles.cardSubtitle}>Optimized to maximize Sharpe Ratio based on your risk profile.</Text>
                
                <View style={styles.allocationContainer}>
                    {Object.entries(optimized_weights).map(([asset, weight], index) => 
                        renderAllocationItem(asset, weight, getChartColor(index))
                    )}
                </View>
            </View>

            {/* 3. Performance Metrics */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Projected Performance</Text>
                <View style={styles.metricsGrid}>
                    <View style={[styles.metricBox, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.metricLabel, { color: colors.primary }]}>Exp. Annual Return</Text>
                        <Text style={[styles.metricValue, { color: colors.primary }]}>{rl_performance.annual_return_pct}%</Text>
                    </View>
                    <View style={[styles.metricBox, { backgroundColor: '#FF980015' }]}>
                        <Text style={[styles.metricLabel, { color: '#FF9800' }]}>Volatility (Risk)</Text>
                        <Text style={[styles.metricValue, { color: '#FF9800' }]}>{rl_performance.annual_volatility_pct}%</Text>
                    </View>
                    <View style={[styles.metricBox, { backgroundColor: '#9C27B015' }]}>
                        <Text style={[styles.metricLabel, { color: '#9C27B0' }]}>Sharpe Ratio</Text>
                        <Text style={[styles.metricValue, { color: '#9C27B0' }]}>{rl_performance.sharpe_ratio}</Text>
                    </View>
                </View>
            </View>

            {/* 4. Monte Carlo Simulation */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Monte Carlo Forecast</Text>
                <Text style={styles.cardSubtitle}>Projected portfolio value if you invest the monthly contribution.</Text>
                
                <View style={styles.forecastRow}>
                    <View style={styles.forecastItem}>
                        <Text style={styles.forecastYear}>5 Years</Text>
                        <Text style={[styles.forecastValue, { color: colors.onSurface }]}>RM {mc_forecast['5yr'].mean_value.toLocaleString()}</Text>
                    </View>
                    <View style={styles.forecastItem}>
                        <Text style={styles.forecastYear}>10 Years</Text>
                        <Text style={[styles.forecastValue, { color: colors.onSurface }]}>RM {mc_forecast['10yr'].mean_value.toLocaleString()}</Text>
                    </View>
                    <View style={styles.forecastItem}>
                        <Text style={styles.forecastYear}>25 Years</Text>
                        <Text style={[styles.forecastValue, { color: colors.onSurface }]}>RM {mc_forecast['25yr'].mean_value.toLocaleString()}</Text>
                    </View>
                </View>
                <Text style={styles.disclaimer}>*Projections are based on 100 stochastic simulations. Past performance is not indicative of future results.</Text>
            </View>

            <View style={{height: 20}} />
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: 'white',
  },
  headerSubtitle: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
  },
  scrollView: { flex: 1, marginTop: -15 },
  scrollContent: { padding: 15 },
  card: {
      borderRadius: 12,
      padding: 18,
      marginBottom: 15,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
  },
  cardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 8,
  },
  cardSubtitle: {
      fontSize: 12,
      opacity: 0.6,
      marginBottom: 15,
  },
  row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
  },
  statItem: {
      flex: 1,
  },
  statLabel: {
      fontSize: 11,
      opacity: 0.6,
      marginBottom: 4,
  },
  statValue: {
      fontSize: 16,
      fontWeight: 'bold',
  },
  divider: {
      height: 1,
      backgroundColor: '#EEEEEE',
      marginVertical: 12,
  },
  allocationContainer: {
      marginTop: 5,
  },
  allocationItem: {
      marginBottom: 12,
  },
  allocationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
  },
  dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
  },
  assetName: {
      fontSize: 14,
      fontWeight: '500',
  },
  assetPercent: {
      fontSize: 14,
      fontWeight: 'bold',
  },
  metricsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
  },
  metricBox: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
  },
  metricLabel: {
      fontSize: 10,
      fontWeight: 'bold',
      marginBottom: 4,
      textAlign: 'center',
  },
  metricValue: {
      fontSize: 16,
      fontWeight: 'bold',
  },
  forecastRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
  },
  forecastItem: {
      alignItems: 'center',
      flex: 1,
  },
  forecastYear: {
      fontSize: 12,
      opacity: 0.6,
      marginBottom: 4,
  },
  forecastValue: {
      fontSize: 14,
      fontWeight: 'bold',
  },
  disclaimer: {
      fontSize: 10,
      opacity: 0.4,
      fontStyle: 'italic',
      marginTop: 15,
      textAlign: 'center',
  },
  errorText: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 10,
  },
  retryButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      marginTop: 10,
  },
});