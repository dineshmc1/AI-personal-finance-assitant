// screens/HomeScreen.js
import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
  RefreshControl
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTransactions } from "../contexts/TransactionContext";
import GlassCard from "../components/GlassCard";
import AnimatedHeader from "../components/AnimatedHeader";

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const HEADER_HEIGHT = 70 + insets.top;

  const {
    transactions,
    accounts,
    updateTransaction,
    deleteTransaction,
    categories,
    getCategoryIcon,
    getMonthlyBalance,
    loadTransactions,
    loadAccounts,
    loadBudgets
  } = useTransactions();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fetchedMonthlyBalance, setFetchedMonthlyBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTransactions(), loadAccounts(), loadBudgets()]);
    setRefreshing(false);
  };

  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // === Animation State ===
  const scrollY = useRef(new Animated.Value(0)).current;

  // Hide Default Header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // === 0. Fetch Monthly Balance ===
  useEffect(() => {
    let isMounted = true;
    const loadMonthly = async () => {
      const bal = await getMonthlyBalance(selectedDate.getFullYear(), selectedDate.getMonth() + 1);
      if (isMounted) setFetchedMonthlyBalance(bal);
    };
    loadMonthly();
    return () => { isMounted = false; };
  }, [selectedDate, transactions]);

  // === 0.5 Calculate Total Account Balance ===
  const realTotalBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + (curr.current_balance || 0), 0);
  }, [accounts]);

  // === 2. Calculate available categories for Edit Modal ===
  const availableEditCategories = useMemo(() => {
    if (!editingTransaction) return [];
    let targetType = 'Expense';
    if (editingTransaction.type === 'income' || editingTransaction.type === 'Income') {
      targetType = 'Income';
    }
    return categories
      .filter(c => c.type === targetType)
      .map(c => c.name);
  }, [categories, editingTransaction]);

  // === 3. Calculate Totals based on current MONTH ===
  const currentMonthTransactions = useMemo(() => {
    console.log("[HomeScreen] Total Transactions:", transactions.length);
    const filtered = transactions.filter(t => {
      if (!t.date) {
        console.log("Excluding tx (no date):", t.description);
        return false;
      }
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) {
        console.log("Excluding tx (invalid date):", t.description, t.date);
        return false;
      }
      const match = tDate.getMonth() === selectedDate.getMonth() &&
        tDate.getFullYear() === selectedDate.getFullYear();

      if (!match) {
        console.log(`Excluding tx: ${t.description} | Date: ${tDate.toDateString()} vs Selected: ${selectedDate.toDateString()}`);
      }
      return match;
    });
    console.log("[HomeScreen] Filtered Transactions for", selectedDate.toDateString(), ":", filtered.length);
    return filtered;
  }, [transactions, selectedDate]);

  const totalIncome = currentMonthTransactions
    .filter(t => t.type === 'income' || t.type === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenditure = currentMonthTransactions
    .filter(t => t.type === 'expend' || t.type === 'Expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // === 4. Filter Transactions for Display ===
  const filteredTransactions = useMemo(() => {
    return currentMonthTransactions.filter(transaction => {
      const matchesFilter = activeFilter === 'all' ||
        (activeFilter === 'expend' && (transaction.type === 'expend' || transaction.type === 'Expense')) ||
        (activeFilter === 'income' && (transaction.type === 'income' || transaction.type === 'Income'));

      const description = transaction.description || "";
      const category = transaction.category || "";
      const matchesSearch =
        description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [currentMonthTransactions, activeFilter, searchQuery]);

  const getUniqueDates = () => {
    const dates = filteredTransactions.map(t => new Date(t.date).toDateString());
    return [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
  };

  const getTransactionsByDate = (dateString) => {
    return filteredTransactions.filter(t =>
      new Date(t.date).toDateString() === dateString
    );
  };

  const changeMonth = (months) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + months);
    setSelectedDate(newDate);
  };

  const onDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatDisplayDate = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "TODAY";
    if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction({
      ...transaction,
      date: new Date(transaction.date).toISOString().split('T')[0]
    });
    setShowEditModal(true);
  };

  const saveEditedTransaction = async () => {
    if (editingTransaction) {
      const updatedTransaction = {
        ...editingTransaction,
        date: new Date(editingTransaction.date),
        amount: parseFloat(editingTransaction.amount)
      };

      await updateTransaction(updatedTransaction);
      setShowEditModal(false);
      setEditingTransaction(null);
      Alert.alert("Success", "Transaction updated successfully!");
    }
  };

  const handleDeleteTransaction = async () => {
    if (editingTransaction) {
      Alert.alert(
        "Delete Transaction",
        "Are you sure you want to delete this transaction?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteTransaction(editingTransaction.id);
              setShowEditModal(false);
              setEditingTransaction(null);
            }
          }
        ]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AnimatedHeader title="Home" scrollY={scrollY} navigation={navigation} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: HEADER_HEIGHT } // Dynamic padding to close the gap
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >



        {/* === Header Card === */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={[colors.primary, colors.tertiary]} // Neon Cyan to Purple
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <SafeAreaView edges={['top']} style={styles.headerContent}>

              {/* Total Balance */}
              <View style={styles.balanceSection}>
                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                  <Text style={styles.balanceAmount}>RM {realTotalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  <Text style={styles.balanceLabel}>Total Balance</Text>
                </View>

                {/* Monthly Balance Row */}
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.balanceAmount, { fontSize: 24, opacity: 0.9 }]}>
                    RM {fetchedMonthlyBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={styles.balanceLabel}>Monthly Balance</Text>
                </View>
              </View>

              {/* Date Navigation */}
              <View style={styles.dateSection}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.dateButton}>
                  <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
                  <GlassCard style={{ paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 }}>
                    <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
                  </GlassCard>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.dateButton}>
                  <MaterialCommunityIcons name="chevron-right" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Income / Expense Summary */}
              <GlassCard style={[styles.expenditureCard, { borderRadius: 30 }]} variant="dark">
                <View style={styles.expenditureRow}>
                  <View style={styles.expenditureItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ padding: 8, backgroundColor: 'rgba(0, 230, 118, 0.2)', borderRadius: 20, marginRight: 8 }}>
                        <MaterialCommunityIcons name="arrow-up" size={16} color="#00e676" />
                      </View>
                      <Text style={styles.expenditureLabel}>Income</Text>
                    </View>
                    <Text style={styles.incomeAmount}>RM {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 0 })}</Text>
                  </View>
                  <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                  <View style={styles.expenditureItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ padding: 8, backgroundColor: 'rgba(255, 23, 68, 0.2)', borderRadius: 20, marginRight: 8 }}>
                        <MaterialCommunityIcons name="arrow-down" size={16} color="#ff1744" />
                      </View>
                      <Text style={styles.expenditureLabel}>Expenses</Text>
                    </View>
                    <Text style={styles.expenseAmount}>RM {totalExpenditure.toLocaleString(undefined, { minimumFractionDigits: 0 })}</Text>
                  </View>
                </View>
              </GlassCard>
            </SafeAreaView>
          </LinearGradient>
        </View>

        <View style={styles.mainContent}>
          {/* === Controls: Search & Filter === */}
          <View style={styles.controlSection}>
            {!showSearch ? (
              <TouchableOpacity onPress={() => setShowSearch(true)}>
                <GlassCard style={styles.searchButton}>
                  <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
                  <Text style={[styles.searchButtonText, { color: colors.onSurface }]}>Search transactions...</Text>
                </GlassCard>
              </TouchableOpacity>
            ) : (
              <GlassCard style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.onSurface }]}
                  placeholder="Search..."
                  placeholderTextColor={colors.onSurface}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(""); }}>
                  <MaterialCommunityIcons name="close" size={20} color={colors.onSurface} />
                </TouchableOpacity>
              </GlassCard>
            )}

            <View style={styles.filterSection}>
              {[
                { key: 'all', label: 'All', icon: 'format-list-bulleted' },
                { key: 'expend', label: 'Expend', icon: 'trending-down' },
                { key: 'income', label: 'Income', icon: 'trending-up' }
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={{ flex: 1, marginHorizontal: 4 }}
                  onPress={() => setActiveFilter(filter.key)}
                >
                  <GlassCard
                    style={[
                      styles.filterButton,
                      activeFilter === filter.key && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={filter.icon}
                      size={16}
                      color={activeFilter === filter.key ? colors.primary : colors.onSurface}
                    />
                    <Text style={[
                      styles.filterText,
                      { color: activeFilter === filter.key ? colors.primary : colors.onSurface }
                    ]}>
                      {filter.label}
                    </Text>
                  </GlassCard>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* === Transaction List === */}
          <View style={styles.transactionsSection}>
            {getUniqueDates().map(dateStr => {
              const dateObj = new Date(dateStr);
              const dayTransactions = getTransactionsByDate(dateStr);

              return (
                <View key={dateStr} style={styles.dateGroup}>
                  <Text style={[styles.dateHeader, { color: colors.primary }]}>
                    {formatDisplayDate(dateObj)}
                  </Text>

                  {dayTransactions.map(transaction => {
                    const isIncome = transaction.type === 'income' || transaction.type === 'Income';
                    const amountColor = isIncome ? '#00e676' : '#ff1744';

                    return (
                      <TouchableOpacity
                        key={transaction.id}
                        onPress={() => handleEditTransaction(transaction)}
                        style={{ marginBottom: 10 }}
                      >
                        <GlassCard style={styles.transactionItem}>
                          <View style={[styles.transactionIcon, { backgroundColor: colors.background, borderColor: colors.primary, borderWidth: 1 }]}>
                            <MaterialCommunityIcons
                              name={getCategoryIcon(transaction.category)}
                              size={20}
                              color={colors.primary}
                            />
                          </View>

                          <View style={styles.transactionInfo}>
                            <Text style={[styles.transactionCategory, { color: colors.onSurface }]}>
                              {transaction.category}
                            </Text>
                            <Text
                              style={[styles.transactionDescription, { color: colors.onSurface }]}
                              numberOfLines={1}
                            >
                              {transaction.description}
                            </Text>
                          </View>

                          <View style={styles.transactionAmountSection}>
                            <Text style={[styles.transactionAmount, { color: amountColor, textShadowColor: amountColor, textShadowRadius: 5 }]}>
                              {isIncome ? '+' : '-'}RM {transaction.amount.toLocaleString()}
                            </Text>
                            <Text style={[styles.transactionTime, { color: colors.onSurface }]}>
                              {transaction.time}
                            </Text>
                          </View>
                        </GlassCard>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}

            {filteredTransactions.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={64} color={colors.onSurface} style={{ opacity: 0.3 }} />
                <Text style={[styles.emptyText, { color: colors.onSurface }]}>No transactions found</Text>
                <Text style={[styles.emptySubtext, { color: colors.onSurface }]}>Try changing the filter or date</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* === Date Picker Modal === */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
        />
      )}

      {/* === Edit Transaction Modal === */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet" transparent>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalContainer, { backgroundColor: '#0a0e17' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.primary }]}>Edit Transaction</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            {editingTransaction && (
              <ScrollView style={styles.editForm}>
                {/* Type Selection */}
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      (editingTransaction.type === 'income' || editingTransaction.type === 'Income') && { backgroundColor: colors.primary + '30', borderColor: colors.primary, borderWidth: 1 }
                    ]}
                    onPress={() => setEditingTransaction({ ...editingTransaction, type: 'income' })}
                  >
                    <Text style={[
                      styles.typeText,
                      { color: (editingTransaction.type === 'income' || editingTransaction.type === 'Income') ? colors.primary : colors.onSurface }
                    ]}>Income</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      (editingTransaction.type === 'expend' || editingTransaction.type === 'Expense') && { backgroundColor: colors.secondary + '30', borderColor: colors.secondary, borderWidth: 1 }
                    ]}
                    onPress={() => setEditingTransaction({ ...editingTransaction, type: 'expend' })}
                  >
                    <Text style={[
                      styles.typeText,
                      { color: (editingTransaction.type === 'expend' || editingTransaction.type === 'Expense') ? colors.secondary : colors.onSurface }
                    ]}>Expense</Text>
                  </TouchableOpacity>
                </View>

                {/* Amount */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.onSurface }]}>Amount (RM)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.onSurface, borderColor: colors.outline }]}
                    value={editingTransaction.amount.toString()}
                    keyboardType="decimal-pad"
                    onChangeText={(text) => setEditingTransaction({ ...editingTransaction, amount: text })}
                  />
                </View>

                {/* Category Grid */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
                  {availableEditCategories.length === 0 && (
                    <Text style={{ color: colors.onSurface, fontStyle: 'italic', marginBottom: 10, opacity: 0.6 }}>
                      Select type to see categories...
                    </Text>
                  )}
                  <View style={styles.categoryGrid}>
                    {availableEditCategories.map((catName) => (
                      <TouchableOpacity
                        key={catName}
                        onPress={() => setEditingTransaction({ ...editingTransaction, category: catName })}
                      >
                        <View style={[
                          styles.categoryButton,
                          editingTransaction.category === catName
                            ? { backgroundColor: colors.primary + '30', borderColor: colors.primary }
                            : { borderColor: 'rgba(255,255,255,0.1)' }
                        ]}>
                          <MaterialCommunityIcons
                            name={getCategoryIcon(catName)}
                            size={16}
                            color={editingTransaction.category === catName ? colors.primary : colors.onSurface}
                          />
                          <Text style={[
                            styles.categoryText,
                            { color: editingTransaction.category === catName ? colors.primary : colors.onSurface }
                          ]}>
                            {catName}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.onSurface }]}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceVariant, color: colors.onSurface, borderColor: colors.outline }]}
                    value={editingTransaction.description}
                    multiline
                    numberOfLines={2}
                    onChangeText={(text) => setEditingTransaction({ ...editingTransaction, description: text })}
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.deleteButton, { backgroundColor: '#FF174420', borderColor: '#FF1744', borderWidth: 1 }]} onPress={handleDeleteTransaction}>
                    <MaterialCommunityIcons name="delete" size={20} color="#FF1744" />
                    <Text style={[styles.deleteButtonText, { color: '#FF1744' }]}>Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={saveEditedTransaction}>
                    <MaterialCommunityIcons name="content-save" size={20} color={colors.background} />
                    <Text style={[styles.saveButtonText, { color: colors.background }]}>Save Changes</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  headerContainer: { overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  header: { paddingBottom: 30 },
  headerContent: {},
  balanceSection: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 4, textShadowColor: 'rgba(255,255,255,0.5)', textShadowRadius: 10 },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  dateSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'center' },
  dateButton: { padding: 8 },
  dateDisplay: { paddingHorizontal: 16 },
  dateText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  expenditureCard: { marginHorizontal: 20, padding: 20 },
  expenditureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expenditureItem: { alignItems: 'center', flex: 1 },
  divider: { width: 1, height: 40 },
  expenditureLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 4, letterSpacing: 1 },
  incomeAmount: { fontSize: 18, fontWeight: 'bold', color: '#00e676', textShadowColor: '#00e676', textShadowRadius: 5 },
  expenseAmount: { fontSize: 18, fontWeight: 'bold', color: '#ff1744', textShadowColor: '#ff1744', textShadowRadius: 5 },

  mainContent: { flex: 1, marginTop: 20 },

  controlSection: { paddingHorizontal: 16, marginBottom: 15 },
  searchButton: { flexDirection: 'row', alignItems: 'center', padding: 15, marginBottom: 15 },
  searchButtonText: { marginLeft: 8, fontSize: 14, opacity: 0.7 },
  searchBar: { flexDirection: 'row', alignItems: 'center', padding: 15, marginBottom: 15 },
  searchInput: { flex: 1, marginLeft: 8, marginRight: 8, fontSize: 14 },

  filterSection: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -4 },
  filterButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  filterText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },

  transactionsSection: { paddingHorizontal: 16, flex: 1 },
  dateGroup: { marginBottom: 15 },
  dateHeader: { fontSize: 14, fontWeight: 'bold', marginVertical: 8, opacity: 0.9, letterSpacing: 1, textTransform: 'uppercase' },

  transactionItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  transactionIcon: { padding: 10, borderRadius: 12, marginRight: 16 },
  transactionInfo: { flex: 1 },
  transactionCategory: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  transactionDescription: { fontSize: 12, opacity: 0.7 },
  transactionAmountSection: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  transactionTime: { fontSize: 11, opacity: 0.6 },

  emptyState: { alignItems: 'center', padding: 40, marginTop: 20 },
  emptyText: { fontSize: 18, textAlign: 'center', fontWeight: 'bold', marginTop: 16 },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 8, opacity: 0.6 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContainer: { height: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold' },
  editForm: { flex: 1 },

  typeSelector: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  typeButton: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  typeText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  categoryButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, margin: 4, borderRadius: 20, borderWidth: 1 },
  categoryText: { fontSize: 12, fontWeight: '500', marginLeft: 4 },

  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 30 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, flex: 1, marginRight: 12, justifyContent: 'center' },
  deleteButtonText: { fontWeight: 'bold', marginLeft: 8 },
  saveButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, flex: 2, justifyContent: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  pageTitle: { fontSize: 34, fontWeight: 'bold', letterSpacing: 0.5 }, // Added style for large title
});