import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Alert
} from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiRequest } from "../services/apiClient";
import ProgressBar from "../components/ProgressBar";

const { width } = Dimensions.get('window');

export default function TwinScreen({ navigation }) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [twinData, setTwinData] = useState(null);

    // === Claim ===
    const [isClaiming, setIsClaiming] = useState(false);

    const loadTwinData = async () => {
        try {
            const data = await apiRequest('/twin/dashboard');
            if (data) {
                setTwinData(data);
            }
        } catch (error) {
            console.error("Twin Data Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTwinData();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadTwinData();
        setRefreshing(false);
    };

    const handleClaimXP = async () => {
        setIsClaiming(true);
        try {
            const res = await apiRequest('/twin/claim-xp', { method: 'POST' });

            if (res && res.message) {
                let msg = res.message;
                if (res.badges_earned && res.badges_earned.length > 0) {
                    msg += `\n\n🏅 You also earned: ${res.badges_earned.join(", ")}!`;
                }
                Alert.alert("🎉 Rewards Claimed!", msg);

                await loadTwinData();
            }
        } catch (error) {
            const errorMessage = error.message || "You cannot claim rewards right now.";
            Alert.alert("Claim Failed", errorMessage);
        } finally {
            setIsClaiming(false);
        }
    };

    // Helper to render twin comparison bar
    const renderTwinBar = (label, scenario, color, isUser = false) => {
        if (!scenario) return null;
        const income = scenario.income || 1;
        const savingsPercent = (scenario.savings / income);

        return (
            <View style={styles.twinRow}>
                <View style={styles.twinHeader}>
                    <View>
                        <Text style={[styles.twinLabel, { color: colors.onSurface }, isUser && { color: colors.primary, fontWeight: 'bold' }]}>
                            {label}
                        </Text>
                        {scenario.potential_xp > 0 && (
                            <Text style={[styles.xpReward, { color: '#FFD700' }]}>
                                +{scenario.potential_xp} XP Potential
                            </Text>
                        )}
                    </View>
                    <Text style={[styles.twinAmount, { color: colors.onSurface }, isUser && { color: colors.primary, fontWeight: 'bold' }]}>
                        RM {scenario.savings.toLocaleString()} saved
                    </Text>
                </View>
                <ProgressBar
                    progress={Math.max(0, Math.min(1, savingsPercent))}
                    color={color}
                    showPercentage={true}
                />
                <Text style={[styles.twinDesc, { color: colors.onSurface }]}>{scenario.description}</Text>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text>Loading your twins...</Text>
            </View>
        );
    }

    if (!twinData) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text>No data available yet.</Text>
                <TouchableOpacity onPress={loadTwinData} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary }}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { gamification_profile, user_stats, easy_twin, medium_twin, hard_twin, battle_status } = twinData;

    const progressToNextLevel = gamification_profile.xp_to_next_level > 0
        ? (gamification_profile.current_xp % 1000) / 1000
        : 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <LinearGradient
                colors={["#00f3ff20", "#8a2be220"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <View style={[styles.avatarContainer, { borderColor: 'white' }]}>
                        <MaterialCommunityIcons name="account-circle" size={60} color="white" />
                        <View style={styles.levelBadge}>
                            <Text style={styles.levelText}>LV.{gamification_profile.level}</Text>
                        </View>
                    </View>
                    <Text style={styles.battleStatus}>{battle_status}</Text>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* XP Progress */}
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <View style={styles.xpHeader}>
                        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>XP Progress</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: colors.onSurface, opacity: 0.6, fontSize: 12 }}>
                                {gamification_profile.current_xp} XP Earned
                            </Text>
                            {twinData.estimated_xp > 0 && (
                                <Text style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 12 }}>
                                    +{twinData.estimated_xp} Potential XP
                                </Text>
                            )}
                        </View>
                    </View>
                    <ProgressBar progress={progressToNextLevel} color="#FFD700" />
                    <Text style={[styles.xpHint, { color: colors.onSurface }]}>Beat twins at the end of the month to gain XP!</Text>
                </View>

                {/* Battle Arena */}
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.cardTitle, { color: colors.onSurface, marginBottom: 15 }]}>Monthly Savings Battle</Text>

                    {renderTwinBar("You (Current)", user_stats, colors.primary, true)}
                    <View style={styles.divider} />
                    {renderTwinBar("Hard Twin (Boss)", hard_twin, "#F44336")}
                    {renderTwinBar("Medium Twin", medium_twin, "#FF9800")}
                    {renderTwinBar("Easy Twin", easy_twin, "#4CAF50")}
                </View>

                {/* Badges Wall */}
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Badges Wall</Text>
                    <View style={styles.badgesContainer}>
                        {gamification_profile.badges.length === 0 ? (
                            <Text style={[styles.noBadges, { color: colors.onSurface }]}>No badges earned yet. Defeat the Hard Twin to earn one!</Text>
                        ) : (
                            gamification_profile.badges.map((badge, index) => (
                                <View key={index} style={styles.badgeItem}>
                                    <View style={styles.badgeIcon}>
                                        <Text style={{ fontSize: 24 }}>{badge.icon}</Text>
                                    </View>
                                    <Text style={[styles.badgeName, { color: colors.onSurface }]}>{badge.name}</Text>
                                </View>
                            ))
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.claimButton, { opacity: isClaiming ? 0.7 : 1 }]}
                    onPress={handleClaimXP}
                    disabled={isClaiming}
                >
                    <LinearGradient
                        colors={['#FFD700', '#FFA500']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.claimGradient}
                    >
                        <MaterialCommunityIcons name="trophy" size={24} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.claimText}>
                            {isClaiming ? "CLAIMING..." : "CLAIM MONTHLY REWARDS"}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
    headerContent: { alignItems: 'center' },
    avatarContainer: { marginBottom: 10, alignItems: 'center' },
    levelBadge: { position: 'absolute', bottom: -5, backgroundColor: '#FFD700', paddingHorizontal: 8, borderRadius: 10, borderWidth: 2, borderColor: 'white' },
    levelText: { fontWeight: 'bold', fontSize: 12, color: 'black' },
    battleStatus: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },

    scrollView: { flex: 1, marginTop: -20 },
    scrollContent: { padding: 16, paddingBottom: 40 },

    card: { borderRadius: 16, padding: 20, marginBottom: 16, elevation: 4 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },

    xpHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    xpHint: { fontSize: 12, fontStyle: 'italic', marginTop: 8, opacity: 0.6 },

    twinRow: { marginBottom: 16 },
    twinHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    twinLabel: { fontSize: 14, fontWeight: '600' },
    twinAmount: { fontSize: 14 },
    xpReward: { fontSize: 10, fontWeight: 'bold' },
    twinDesc: { fontSize: 11, opacity: 0.6, marginTop: 4 },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },

    badgesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 10 },
    badgeItem: { alignItems: 'center', width: '30%' },
    badgeIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    badgeName: { fontSize: 12, textAlign: 'center' },
    noBadges: { fontStyle: 'italic', opacity: 0.6, marginTop: 5 },

    // === Claim Button Styles ===
    claimButton: {
        marginTop: 10,
        borderRadius: 12,
        elevation: 5,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    claimGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
    },
    claimText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    }
});