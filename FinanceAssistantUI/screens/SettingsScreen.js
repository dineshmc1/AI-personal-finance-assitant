// screens/SettingsScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated
} from "react-native";
import { useRef } from "react";
import AnimatedHeader from "../components/AnimatedHeader";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTransactions } from "../contexts/TransactionContext";
import { useSettings } from "../contexts/SettingsContext";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function SettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const { transactions, clearAllTransactions } = useTransactions();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [settings, setSettings] = useState({
    // App Settings
    darkMode: false,
    biometricAuth: false,
    darkMode: false,
    biometricAuth: false,
    budgetAlerts: true,
    autoBackup: true,
  });

  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { currency, updateCurrency: setGlobalCurrency, isDarkMode, toggleTheme } = useSettings();
  const [newCurrency, setNewCurrency] = useState(currency);

  const handleChangeCurrency = async () => {
    await setGlobalCurrency(newCurrency);
    setShowCurrencyModal(false);
    Alert.alert("Success", `Currency changed to ${newCurrency}`);
  };

  const toggleSetting = (setting) => {
    setSettings({ ...settings, [setting]: !settings[setting] });
  };

  // Export transactions as CSV
  const handleExportData = async () => {
    try {
      setIsExporting(true);

      // Create CSV content
      let csvContent = "Date,Time,Type,Category,Amount,Description\n";

      transactions.forEach(transaction => {
        const date = new Date(transaction.date).toISOString().split('T')[0];
        const amount = transaction.type === 'expend' ? -transaction.amount : transaction.amount;

        csvContent += `"${date}","${transaction.time}","${transaction.type}","${transaction.category}","${amount}","${transaction.description}"\n`;
      });

      // Create file
      const fileUri = FileSystem.documentDirectory + `financial_data_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Financial Data',
        });
      } else {
        Alert.alert("Export Complete", "Data exported successfully!");
      }

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert("Export Failed", "Could not export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Clear all data
  const handleClearData = async () => {
    try {
      setIsResetting(true);

      // Clear transactions from context
      clearAllTransactions();

      // Clear any stored data
      await AsyncStorage.multiRemove([
        'transactions',
        'userSettings',
        'budgets',
        'goals'
      ]);

      Alert.alert("Success", "All data has been cleared successfully!");
      setShowResetModal(false);

    } catch (error) {
      console.error('Clear data error:', error);
      Alert.alert("Error", "Failed to clear data. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };



  // App information
  const getAppStats = () => {
    const totalTransactions = transactions.length;
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
      .filter(t => t.type === 'expend')
      .reduce((sum, t) => sum + t.amount, 0);

    return { totalTransactions, totalIncome, totalExpenses };
  };

  const appStats = getAppStats();

  const settingSections = [
    {
      title: "App Preferences",
      icon: "cog",
      items: [
        {
          label: "Dark Mode",
          description: "Switch between light and dark theme",
          value: isDarkMode,
          onToggle: toggleTheme,
          icon: "theme-light-dark"
        },
        {
          label: "Budget Alerts",
          description: "Get notified when approaching budget limits",
          value: settings.budgetAlerts,
          onToggle: () => toggleSetting('budgetAlerts'),
          icon: "alert-circle"
        },
        {
          label: "Auto Backup",
          description: "Automatically backup your data",
          value: settings.autoBackup,
          onToggle: () => toggleSetting('autoBackup'),
          icon: "cloud-upload"
        },
      ]
    },
    {
      title: "Security",
      icon: "shield-account",
      items: [
        {
          label: "Biometric Lock",
          description: "Use fingerprint or face ID to unlock",
          value: settings.biometricAuth,
          onToggle: () => toggleSetting('biometricAuth'),
          icon: "fingerprint"
        },
      ]
    },
    {
      title: "Data & Storage",
      icon: "database",
      items: [
        {
          label: "Export Data",
          description: "Download all your financial data as CSV",
          type: 'action',
          onPress: handleExportData,
          icon: "download",
          loading: isExporting
        },
        {
          label: "Reset All Data",
          description: "Clear all transactions and settings",
          type: 'action',
          onPress: () => setShowResetModal(true),
          icon: "delete",
          destructive: true
        },
      ]
    }
  ];

  const currencyOptions = [
    { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AnimatedHeader
        title="Settings"
        scrollY={scrollY}
        navigation={navigation}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 100, paddingBottom: 100 }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <Text style={[styles.title, { color: colors.primary, textShadowColor: colors.primary, textShadowRadius: 10 }]}>Settings</Text>

        {/* App Statistics */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statsTitle, { color: colors.onSurface }]}>App Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="swap-horizontal" size={24} color={colors.primary} />
              <Text style={[styles.statNumber, { color: colors.primary }]}>{appStats.totalTransactions}</Text>
              <Text style={[styles.statLabel, { color: colors.onSurface }]}>Transactions</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="trending-up" size={24} color="#4CAF50" />
              <Text style={[styles.statNumber, { color: "#4CAF50" }]}>
                RM {appStats.totalIncome.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.onSurface }]}>Total Income</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="trending-down" size={24} color="#F44336" />
              <Text style={[styles.statNumber, { color: "#F44336" }]}>
                RM {appStats.totalExpenses.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.onSurface }]}>Total Expenses</Text>
            </View>
          </View>
        </View>

        {/* Currency Selection */}
        <View style={[styles.currencySection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Currency</Text>
          <TouchableOpacity
            style={[styles.currencyButton, { borderColor: colors.primary }]}
            onPress={() => setShowCurrencyModal(true)}
          >
            <MaterialCommunityIcons name="currency-usd" size={20} color={colors.primary} />
            <Text style={[styles.currencyText, { color: colors.onSurface }]}>
              {currency} - {currencyOptions.find(c => c.code === currency)?.name}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Settings Sections */}
        {settingSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name={section.icon} size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{section.title}</Text>
            </View>

            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.settingItem,
                    { backgroundColor: colors.surface },
                    item.destructive && { borderLeftColor: '#F44336', borderLeftWidth: 4 }
                  ]}
                  onPress={item.type === 'action' ? item.onPress : undefined}
                  disabled={item.loading}
                >
                  <View style={styles.settingLeft}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={22}
                      color={item.destructive ? '#F44336' : colors.primary}
                    />
                    <View style={styles.settingInfo}>
                      <Text style={[
                        styles.settingLabel,
                        { color: item.destructive ? '#F44336' : colors.onSurface }
                      ]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.settingDescription, { color: colors.onSurface }]}>
                        {item.description}
                      </Text>
                    </View>
                  </View>

                  {item.type === 'action' ? (
                    item.loading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={item.destructive ? '#F44336' : colors.onSurface}
                      />
                    )
                  ) : (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{ false: colors.outline, true: colors.primary + '80' }}
                      thumbColor={item.value ? colors.primary : colors.surface}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* App Information */}
        <View style={[styles.infoSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.infoTitle, { color: colors.onSurface }]}>App Information</Text>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.onSurface }]}>Version</Text>
            <Text style={[styles.infoValue, { color: colors.primary }]}>1.0.0</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.onSurface }]}>Build Date</Text>
            <Text style={[styles.infoValue, { color: colors.primary }]}>March 2024</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.onSurface }]}>Developer</Text>
            <Text style={[styles.infoValue, { color: colors.primary }]}>Finance Assistant Team</Text>
          </View>
        </View>

        {/* Currency Selection Modal */}
        <Modal visible={showCurrencyModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.primary }]}>Select Currency</Text>
                <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.currencyList}>
                {currencyOptions.map((currency) => (
                  <TouchableOpacity
                    key={currency.code}
                    style={[
                      styles.currencyOption,
                      {
                        backgroundColor: newCurrency === currency.code ? colors.primary + '20' : 'transparent',
                        borderColor: colors.outline
                      }
                    ]}
                    onPress={() => setNewCurrency(currency.code)}
                  >
                    <View style={styles.currencyInfo}>
                      <Text style={[styles.currencyCode, { color: colors.primary }]}>
                        {currency.symbol} {currency.code}
                      </Text>
                      <Text style={[styles.currencyName, { color: colors.onSurface }]}>
                        {currency.name}
                      </Text>
                    </View>
                    {newCurrency === currency.code && (
                      <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.surface }]}
                  onPress={() => setShowCurrencyModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleChangeCurrency}
                >
                  <Text style={[styles.modalButtonText, { color: colors.surface }]}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Reset Confirmation Modal */}
        <Modal visible={showResetModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <MaterialCommunityIcons name="alert" size={32} color="#F44336" />
                <Text style={[styles.modalTitle, { color: colors.primary }]}>Reset All Data</Text>
              </View>

              <Text style={[styles.modalMessage, { color: colors.onSurface }]}>
                This will permanently delete:
                {"\n\n"}
                • All transactions
                {"\n"}
                • Budget settings
                {"\n"}
                • Financial goals
                {"\n"}
                • App preferences
                {"\n\n"}
                This action cannot be undone!
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.surface }]}
                  onPress={() => setShowResetModal(false)}
                  disabled={isResetting}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#F44336' }]}
                  onPress={handleClearData}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: 'white' }]}>Delete All</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginVertical: 15 },

  // Stats Card
  statsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  statItem: {
    alignItems: "center",
    flex: 1
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center"
  },

  // Currency Section
  currencySection: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3
  },
  currencyButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10
  },
  currencyText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10
  },

  // Settings Sections
  section: { marginBottom: 25 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    paddingHorizontal: 5
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10
  },
  sectionContent: { borderRadius: 12, overflow: "hidden" },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    marginBottom: 1,
    elevation: 2
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  settingInfo: {
    flex: 1,
    marginLeft: 15
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2
  },
  settingDescription: {
    fontSize: 12,
    opacity: 0.7
  },

  // Info Section
  infoSection: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: "500" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center'
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold'
  },

  // Currency List
  currencyList: {
    maxHeight: 300
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8
  },
  currencyInfo: {
    flex: 1
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2
  },
  currencyName: {
    fontSize: 14,
    opacity: 0.7
  }
});