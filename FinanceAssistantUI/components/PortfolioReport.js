import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Switch } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

const ASSET_LABELS = {
    'Crypto': { color: '#F7931A', icon: 'bitcoin' },
    'Stocks': { color: '#007AFF', icon: 'chart-line' },
    'ETF': { color: '#5856D6', icon: 'chart-box-outline' },
    'Retirement': { color: '#34C759', icon: 'piggy-bank' },
    'RealEstate': { color: '#AF52DE', icon: 'home-city' },
    'Gold': { color: '#FFD700', icon: 'gold' },
    'Bonds': { color: '#FF9500', icon: 'file-certificate' },
    'Cash': { color: '#ADA4A5', icon: 'cash' },
};

export default function PortfolioReport({ report, onRetrain, isRetraining }) {
    const { colors } = useTheme();
    const { currencySymbol } = useSettings();
    const [selectedHorizon, setSelectedHorizon] = useState('5yr'); // 5yr, 10yr, 25yr
    const [assetSelection, setAssetSelection] = useState({
        'Crypto': true,
        'Stocks': true,
        'ETF': true,
        'Retirement': true,
        'RealEstate': true,
        'Gold': true,
        'Bonds': true,
        'Cash': true,
    });
    const [showConfig, setShowConfig] = useState(false);

    if (!report) return null;

    const { rl_performance, optimized_weights, mc_forecast, personalization } = report;
    const graphData = mc_forecast.graphs[selectedHorizon];

    // Format formatted weights for Pie Chart
    const pieData = Object.keys(optimized_weights)
        .filter(k => optimized_weights[k] > 0)
        .map(key => ({
            name: key,
            population: optimized_weights[key],
            color: ASSET_LABELS[key]?.color || '#808080',
            legendFontColor: colors.onSurface,
            legendFontSize: 12
        }));

    const handleToggleAsset = (asset) => {
        setAssetSelection(prev => ({ ...prev, [asset]: !prev[asset] }));
    };

    const handleRetrain = () => {
        const included = Object.keys(assetSelection).filter(k => assetSelection[k]).join(',');
        onRetrain(included);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceVariant + '30' }]}>
            <Text style={[styles.title, { color: colors.primary }]}>🚀 AI Optimization Results</Text>

            {/* New: Monthly Contribution Display */}
            <View style={{ alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>Calculated Monthly Contribution</Text>
                <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold' }}>
                    {currencySymbol} {personalization?.monthly_contribution?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                </Text>
            </View>

            {/* 1. Performance Summary */}
            <View style={styles.metricsRow}>
                <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.metricLabel, { color: colors.onSurface + '80' }]}>Annual Return</Text>
                    <Text style={[styles.metricValue, { color: '#34C759' }]}>
                        {rl_performance.annual_return_pct}%
                    </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.metricLabel, { color: colors.onSurface + '80' }]}>Sharpe Ratio</Text>
                    <Text style={[styles.metricValue, { color: colors.primary }]}>
                        {rl_performance.sharpe_ratio}
                    </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.metricLabel, { color: colors.onSurface + '80' }]}>Volatility</Text>
                    <Text style={[styles.metricValue, { color: '#FF9500' }]}>
                        {rl_performance.annual_volatility_pct}%
                    </Text>
                </View>
            </View>

            {/* 2. Forecast Graph */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.chartHeaderContainer}>
                    <Text style={[styles.cardTitle, { color: colors.onSurface, textAlign: 'center' }]}>Monte Carlo Forecast</Text>
                    <View style={[styles.tabs, { backgroundColor: colors.surfaceVariant }]}>
                        {['5yr', '10yr', '25yr'].map(h => (
                            <TouchableOpacity
                                key={h}
                                onPress={() => setSelectedHorizon(h)}
                                style={[
                                    styles.tab,
                                    selectedHorizon === h && { backgroundColor: colors.primary }
                                ]}
                            >
                                <Text style={[
                                    styles.tabText,
                                    { color: selectedHorizon === h ? colors.surface : colors.onSurface }
                                ]}>{h}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {graphData ? (
                    <LineChart
                        data={{
                            labels: graphData.years.map((y, index) => {
                                if (selectedHorizon === '25yr') {
                                    // Show every 3rd label for 25yr to avoid clutter
                                    return index % 3 === 0 ? `Y${y}` : '';
                                }
                                return `Y${y}`;
                            }),
                            datasets: [{ data: graphData.values }]
                        }}
                        width={SCREEN_WIDTH - 60}
                        height={220}
                        yAxisLabel={currencySymbol}
                        yAxisSuffix="k"
                        formatYLabel={(y) => {
                            // Simple k formatter if numbers are large, or let chartkit handle suffixes?
                            // chartkit appends suffix. We assume values are already scaled or raw?
                            // Backend sends raw floats. ChartKit parses them. 
                            // If values are e.g. 20000, it shows 20000k if we add k? No.
                            // Let's assume we want valid numbers.
                            // Actually user screenshot shows "$21165k". 
                            // If `yAxisSuffix="k"`, it appends 'k'. 
                            // If backend returns 21165000, chartkit might show 2.11e7.
                            // Usually we might want to divide by 1000 in data, or use formatted label.
                            return (parseInt(y) / 1000).toFixed(0);
                        }}
                        chartConfig={{
                            backgroundColor: colors.surface,
                            backgroundGradientFrom: colors.surface,
                            backgroundGradientTo: colors.surface,
                            decimalPlaces: 0,
                            color: (opacity = 1) => colors.primary,
                            labelColor: (opacity = 1) => colors.onSurface + '90',
                            propsForDots: { r: "3" },
                            style: { borderRadius: 16 }
                        }}
                        style={styles.chart}
                        bezier
                    />
                ) : (
                    <Text>No Graph Data</Text>
                )}
            </View>

            {/* 3. Optimal Allocation */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Optimal Allocation</Text>
                <View style={styles.pieContainer}>
                    <PieChart
                        data={pieData}
                        width={SCREEN_WIDTH - 60}
                        height={200}
                        chartConfig={{
                            color: (opacity = 1) => colors.onSurface,
                        }}
                        accessor={"population"}
                        backgroundColor={"transparent"}
                        paddingLeft={"15"}
                        absolute
                    />
                </View>
            </View>

            {/* 4. Configuration / Retrain */}
            <TouchableOpacity
                style={[styles.configButton, { borderColor: colors.outline }]}
                onPress={() => setShowConfig(!showConfig)}
            >
                <Text style={{ color: colors.primary }}>
                    {showConfig ? "Hide Settings" : "⚙️ Customize Portfolio Assets"}
                </Text>
            </TouchableOpacity>

            {showConfig && (
                <View style={[styles.configPanel, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.configTitle, { color: colors.onSurface }]}>Select Assets to Include:</Text>
                    <View style={styles.switches}>
                        {Object.keys(ASSET_LABELS).map(asset => (
                            <View key={asset} style={styles.switchRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name={ASSET_LABELS[asset].icon} size={20} color={ASSET_LABELS[asset].color} style={{ marginRight: 8 }} />
                                    <Text style={{ color: colors.onSurface }}>{asset}</Text>
                                </View>
                                <Switch
                                    value={assetSelection[asset]}
                                    onValueChange={() => handleToggleAsset(asset)}
                                    trackColor={{ true: colors.primary }}
                                />
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.trainButton, { backgroundColor: colors.primary }]}
                        onPress={handleRetrain}
                        disabled={isRetraining}
                    >
                        {isRetraining ? (
                            <ActivityIndicator color={colors.surface} />
                        ) : (
                            <Text style={[styles.trainButtonText, { color: colors.surface }]}>Train Again 🔄</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 12, borderRadius: 16, marginVertical: 8 },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    metricCard: { flex: 1, padding: 10, borderRadius: 12, alignItems: 'center', marginHorizontal: 4, elevation: 1 },
    metricLabel: { fontSize: 11, marginBottom: 4 },
    metricValue: { fontSize: 16, fontWeight: 'bold' },

    card: { borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
    cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },

    chartHeaderContainer: { alignItems: 'center', marginBottom: 10 },
    tabs: { flexDirection: 'row', borderRadius: 8, padding: 2, marginTop: 8 },
    tab: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
    tabText: { fontSize: 12, fontWeight: '500' },
    chart: { marginVertical: 8, borderRadius: 16, marginLeft: -20 }, // slight offset/fix for chartkit labels

    configButton: { padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginBottom: 10 },
    configPanel: { padding: 16, borderRadius: 12 },
    configTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
    switches: { flexDirection: 'row', flexWrap: 'wrap' },
    switchRow: { width: '50%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 10, marginBottom: 8 },

    trainButton: { padding: 14, borderRadius: 24, alignItems: 'center', marginTop: 16 },
    trainButtonText: { fontWeight: 'bold' }
});
