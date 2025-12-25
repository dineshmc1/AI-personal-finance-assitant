import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, TextInput as RNTextInput, Keyboard, TouchableOpacity, StatusBar, Animated } from 'react-native';
import { useRef } from 'react';
import AnimatedHeader from '../components/AnimatedHeader';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { apiRequest } from '../services/apiClient';
import GlassCard from '../components/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';

const screenWidth = Dimensions.get('window').width;

export default function SimulationScreen({ navigation }) {
    const theme = useTheme();
    const { colors } = theme;
    const [question, setQuestion] = useState('');
    const scrollY = useRef(new Animated.Value(0)).current;
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleSimulate = async () => {
        if (!question.trim()) return;
        Keyboard.dismiss();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const encodedQ = encodeURIComponent(question);
            const data = await apiRequest(`/reports/simulate?user_question=${encodedQ}`, {
                method: 'POST'
            });

            if (data.status === 'general_chat') {
                setError("Not enough data for detailed simulation charts, but here is some advice:\n\n" + data.simulation_report);
            } else {
                setResult(data);
            }

        } catch (err) {
            setError(err.message || "Simulation failed.");
        } finally {
            setLoading(false);
        }
    };

    const renderCharts = () => {
        if (!result || !result.raw_simulation_data) return null;

        const simData = result.raw_simulation_data;
        const balanceData = simData.daily_balances;
        const labels = balanceData.map((_, i) => `M${i}`);

        return (
            <View>
                <GlassCard style={styles.card}>
                    <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 15, color: colors.primary }}>Projected Balance Impact</Text>
                    <LineChart
                        data={{
                            labels: labels,
                            datasets: [{ data: balanceData }]
                        }}
                        width={screenWidth - 48}
                        height={220}
                        chartConfig={{
                            backgroundColor: "transparent",
                            backgroundGradientFrom: "transparent",
                            backgroundGradientTo: "transparent",
                            backgroundGradientFromOpacity: 0,
                            backgroundGradientToOpacity: 0,
                            decimalPlaces: 0,
                            color: (opacity = 1) => colors.secondary, // Neon Pink
                            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.8})`,
                            propsForDots: { r: "4", strokeWidth: "2", stroke: colors.secondary, fill: colors.background },
                            propsForBackgroundLines: { strokeDasharray: "" } // Solid grid
                        }}
                        bezier
                        style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                    <Text style={{ textAlign: 'center', fontSize: 14, marginTop: 10, color: colors.onSurface }}>
                        Start: <Text style={{ fontWeight: 'bold' }}>RM{simData.initial_balance}</Text> → End: <Text style={{ fontWeight: 'bold', color: colors.secondary }}>RM{simData.final_balance}</Text>
                    </Text>
                </GlassCard>

                <View style={styles.statsRow}>
                    <GlassCard style={styles.statCard}>
                        <Text style={{ fontSize: 12, color: colors.onSurface, opacity: 0.7 }}>Net Savings</Text>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#00e676', marginTop: 5, textShadowColor: '#00e676', textShadowRadius: 5 }}>
                            +RM {simData.net_savings}
                        </Text>
                    </GlassCard>
                    <GlassCard style={styles.statCard}>
                        <Text style={{ fontSize: 12, color: colors.onSurface, opacity: 0.7 }}>FHS Score</Text>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#ffea00', marginTop: 5, textShadowColor: '#ffea00', textShadowRadius: 5 }}>
                            {simData.final_fhs}
                        </Text>
                    </GlassCard>
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar barStyle="light-content" backgroundColor={colors.background} />
            <AnimatedHeader
                title="What-If Simulator"
                subtitle="Test Financial Scenarios"
                scrollY={scrollY}
                navigation={navigation}
            />
            <Animated.ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingTop: 100, paddingBottom: 50 }}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.primary, textShadowColor: colors.primary, textShadowRadius: 10 }]}>What-If Simulator</Text>
                    <Text style={{ color: colors.onSurface, opacity: 0.7, fontSize: 14 }}>
                        Test different financial scenarios.
                    </Text>
                </View>

                <GlassCard style={styles.inputCard}>
                    <Text style={{ marginBottom: 10, color: colors.onSurface, fontWeight: '600' }}>Enter your scenario:</Text>
                    <RNTextInput
                        style={[styles.input, { color: colors.onSurface, borderColor: colors.primary, backgroundColor: colors.surfaceVariant }]}
                        placeholder="e.g. What if I save RM 500 monthly?"
                        placeholderTextColor={colors.onSurface + '60'}
                        value={question}
                        onChangeText={setQuestion}
                        multiline
                    />

                    <TouchableOpacity
                        onPress={handleSimulate}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={loading ? [colors.surface, colors.surface] : [colors.primary, colors.secondary]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
                        >
                            {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: colors.background, fontWeight: 'bold', fontSize: 16 }}>Run Simulation</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                </GlassCard>

                {error && (
                    <GlassCard style={[styles.card, { marginTop: 20, borderColor: colors.error }]}>
                        <Text style={{ color: colors.error, textAlign: 'center' }}>{error}</Text>
                    </GlassCard>
                )}

                {result && (
                    <View style={{ marginTop: 20 }}>
                        {renderCharts()}

                        <GlassCard style={styles.card}>
                            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 10, color: colors.tertiary }}>AI Analysis</Text>
                            <Text style={{ fontSize: 14, lineHeight: 24, color: colors.onSurface, opacity: 0.9 }}>
                                {result.simulation_report}
                            </Text>
                        </GlassCard>
                    </View>
                )}

                <View style={{ height: 40 }} />
                <View style={{ height: 40 }} />
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    header: { marginBottom: 25, alignItems: 'center' },
    title: { fontSize: 26, fontWeight: 'bold', marginBottom: 5, letterSpacing: 1 },
    card: { marginBottom: 20, padding: 20 },
    inputCard: { padding: 20 },
    input: {
        height: 80,
        borderWidth: 1,
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        fontSize: 16,
        textAlignVertical: 'top'
    },
    button: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
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
});
