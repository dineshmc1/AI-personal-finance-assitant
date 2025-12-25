import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    Animated
} from "react-native";
import { useRef } from "react";
import AnimatedHeader from "../components/AnimatedHeader";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiRequest } from "../services/apiClient";
import PortfolioReport from '../components/PortfolioReport';

const { width } = Dimensions.get('window');

export default function ReportsScreen({ navigation }) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [error, setError] = useState(null);
    const scrollY = useRef(new Animated.Value(0)).current;

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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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

    const handleRetrain = async (includedAssets) => {
        setLoading(true);
        try {
            // Fetch data with included_assets param
            const data = await apiRequest(`/reports/optimization/rl?included_assets=${encodeURIComponent(includedAssets)}`);

            if (data) {
                setReportData(data);
            }
        } catch (err) {
            console.error("Optimization Retrain Error:", err);
            setError(err.message || "Retraining failed.");
        } finally {
            setLoading(false);
        }
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


    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <AnimatedHeader
                title="AI Analysis"
                scrollY={scrollY}
                navigation={navigation}
            />
            <Animated.ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingTop: 100 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.header}>
                    <View style={styles.headerContent}>
                        <View>
                            <Text style={styles.headerTitle}>AI Portfolio Optimization</Text>
                            <Text style={styles.headerSubtitle}>Reinforcement Learning (PPO) Model</Text>
                        </View>
                        <MaterialCommunityIcons name="brain" size={32} color="white" style={{ opacity: 0.8 }} />
                    </View>
                </LinearGradient>
                <PortfolioReport
                    report={reportData}
                    onRetrain={handleRetrain}
                    isRetraining={loading} // Use loading state for button spinner
                />

                <View style={{ height: 20 }} />
                <View style={{ height: 20 }} />
            </Animated.ScrollView>
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