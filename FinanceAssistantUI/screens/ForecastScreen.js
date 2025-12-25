import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Dimensions, TouchableOpacity, StatusBar, RefreshControl, Animated } from 'react-native';
import { useRef } from 'react';
import AnimatedHeader from '../components/AnimatedHeader';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { apiRequest } from '../services/apiClient';
import GlassCard from '../components/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';

const screenWidth = Dimensions.get('window').width;

export default function ForecastScreen({ navigation }) {
    const { token } = useAuth();
    const { colors } = useTheme();
    const { isDarkMode } = useSettings();
    const [loading, setLoading] = useState(true);
    const scrollY = useRef(new Animated.Value(0)).current;
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchForecast();
    }, []);

    const fetchForecast = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiRequest('/reports/forecast/lstm');
            setReport(data);
        } catch (err) {
            setError(err.message || "Failed to load forecast.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchForecast();
    };

    if (loading && !refreshing) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: colors.onSurface }}>Analyzing financial data...</Text>
            </View>
        );
    }

    if (error && !refreshing) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.error, marginBottom: 15, textAlign: 'center' }}>{error}</Text>
                <TouchableOpacity
                    onPress={fetchForecast}
                    style={{ backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 }}
                >
                    <Text style={{ color: colors.background, fontWeight: 'bold' }}>Retry Projection</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!report || !report.forecast_results) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.onSurface }}>No forecast data available.</Text>
            </View>
        );
    }

    // Chart Data Preparation
    const labels = report.forecast_results.filter((_, i) => i % 5 === 0).map(item => item.date.slice(5)); // MM-DD
    const balanceData = report.forecast_results.map(item => item.forecast_balance);

    const chartData = {
        labels: labels,
        datasets: [
            {
                data: balanceData,
                color: (opacity = 1) => colors.primary, // Neon Cyan Line
                strokeWidth: 4
            }
        ],
        legend: ["Projected Balance"]
    };

    const chartConfig = {
        backgroundColor: "transparent",
        backgroundGradientFrom: "transparent",
        backgroundGradientTo: "transparent",
        backgroundGradientFromOpacity: 0,
        backgroundGradientToOpacity: 0,
        decimalPlaces: 0,
        color: (opacity = 1) => isDarkMode
            ? `rgba(255, 255, 255, ${opacity * 0.5})`
            : `rgba(0, 0, 0, ${opacity * 0.2})`, // Grid lines
        labelColor: (opacity = 1) => isDarkMode
            ? `rgba(255, 255, 255, ${opacity * 0.8})`
            : `rgba(0, 0, 0, ${opacity * 0.8})`,
        style: {
            borderRadius: 16
        },
        propsForDots: {
            r: "5",
            strokeWidth: "2",
            stroke: colors.primary,
            fill: colors.background
        },
        propsForBackgroundLines: {
            strokeDasharray: "" // Solid grid lines
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0e17" />
            <AnimatedHeader
                title="Future Balance"
                scrollY={scrollY}
                navigation={navigation}
            />
            <Animated.ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingTop: 100, paddingBottom: 50 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.primary, textShadowColor: colors.primary, textShadowRadius: 10 }]}>Future Balance</Text>
                    <Text style={{ color: colors.onSurface, opacity: 0.7, fontSize: 14, marginTop: 5 }}>
                        AI Prediction for next 30 days
                    </Text>
                </View>

                <LinearGradient
                    colors={[colors.surface, colors.surfaceVariant]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[styles.card, { borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.outline }]}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={24} color={colors.primary} />
                        </View>
                        <View>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.onSurface }}>Value Projection</Text>
                            <Text style={{ fontSize: 12, color: colors.onSurfaceVariant }}>Next 30 Days Trend</Text>
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <LineChart
                            data={chartData}
                            width={screenWidth * 2}
                            height={240}
                            chartConfig={{
                                ...chartConfig,
                                fillShadowGradient: colors.primary,
                                fillShadowGradientOpacity: 0.3,
                                propsForDots: {
                                    r: "5",
                                    strokeWidth: "2",
                                    stroke: colors.surface,
                                    fill: colors.primary
                                }
                            }}
                            bezier
                            style={{
                                marginVertical: 8,
                                borderRadius: 16,
                                paddingRight: 50,
                                paddingLeft: 20
                            }}
                            withInnerLines={true}
                            withOuterLines={false}
                            withVerticalLines={false}
                            yAxisLabel=""
                            yAxisInterval={1}
                            formatYLabel={(y) => {
                                if (y >= 1000) return (y / 1000).toFixed(1) + 'k';
                                return parseFloat(y).toFixed(0);
                            }}
                        />
                    </ScrollView>
                </LinearGradient>

                <View style={styles.statsRow}>
                    <LinearGradient
                        colors={[colors.primary + '30', colors.primary + '05']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[styles.statCard, { borderRadius: 20, borderWidth: 1, borderColor: colors.primary + '30' }]}
                    >
                        <View style={{ alignItems: 'center', width: '100%' }}>
                            <MaterialCommunityIcons name="wallet" size={24} color={colors.primary} style={{ marginBottom: 8 }} />
                            <Text style={{ fontSize: 12, color: colors.onSurface, opacity: 0.8, marginBottom: 4 }}>End Balance</Text>
                            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.onSurface }}>
                                RM {report.summary.forecast_end_balance.toLocaleString()}
                            </Text>
                        </View>
                    </LinearGradient>

                    <LinearGradient
                        colors={['#00e67630', '#00e67605']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[styles.statCard, { borderRadius: 20, borderWidth: 1, borderColor: '#00e67630' }]}
                    >
                        <View style={{ alignItems: 'center', width: '100%' }}>
                            <MaterialCommunityIcons name="chart-line-variant" size={24} color="#00e676" style={{ marginBottom: 8 }} />
                            <Text style={{ fontSize: 12, color: colors.onSurface, opacity: 0.8, marginBottom: 4 }}>Net Growth</Text>
                            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.onSurface }}>
                                +RM {report.summary.net_flow_forecast.toLocaleString()}
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                <LinearGradient
                    colors={[colors.surfaceVariant, colors.surface]}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={[styles.card, { borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.outline }]}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tertiary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <MaterialCommunityIcons name="robot-confused" size={24} color={colors.tertiary} />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.onSurface }}>AI Analysis Summary</Text>
                    </View>

                    <Text style={{ color: colors.onSurface, lineHeight: 24, fontSize: 15, opacity: 0.9 }}>
                        Based on your spending habits from <Text style={{ fontWeight: 'bold', color: colors.tertiary }}>{report.summary.model_notes}</Text>,
                        we estimate your balance will move from <Text style={{ fontWeight: 'bold' }}>RM {report.summary.start_balance}</Text> to <Text style={{ fontWeight: 'bold' }}>RM {report.summary.forecast_end_balance}</Text>.
                    </Text>

                    <View style={{ marginTop: 20, flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1, backgroundColor: colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)' }}>
                            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginBottom: 4 }}>Expected Income</Text>
                            <Text style={{ color: '#00e676', fontWeight: 'bold', fontSize: 16 }}>+RM {report.summary.forecast_total_income}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,23,68,0.2)' }}>
                            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginBottom: 4 }}>Expected Expense</Text>
                            <Text style={{ color: '#ff1744', fontWeight: 'bold', fontSize: 16 }}>-RM {report.summary.forecast_total_expense}</Text>
                        </View>
                    </View>
                </LinearGradient>

                <View style={{ height: 30 }} />
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        marginVertical: 20,
        alignItems: 'center'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        letterSpacing: 1
    },
    card: {
        marginBottom: 20,
        padding: 20,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    }
});
