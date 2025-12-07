// screens/HomeScreen.js
import React, { useState, useMemo } from "react";
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
  Platform
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTransactions } from "../contexts/TransactionContext";

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { colors } = useTheme();
  // 1. Get transactions and actions from Context
  const { 
    transactions, 
    updateTransaction, 
    deleteTransaction, 
    categories, 
    getCategoryIcon 
  } = useTransactions();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // === 2. Calculate available categories for Edit Modal ===
  const availableEditCategories = useMemo(() => {
      if (!editingTransaction) return [];
      
      // Determine if we need Income or Expense categories
      let targetType = 'Expense';
      if (editingTransaction.type === 'income' || editingTransaction.type === 'Income') {
          targetType = 'Income';
      }
      
      return categories
        .filter(c => c.type === targetType)
        .map(c => c.name);
  }, [categories, editingTransaction]);

  // === 3. Calculate Totals based on current MONTH  ===
  const currentMonthTransactions = useMemo(() => {
    if (!transactions) return [];
    
    return transactions.filter(t => {
      if (!t.date) return false;
      return t.date.getMonth() === selectedDate.getMonth() &&
             t.date.getFullYear() === selectedDate.getFullYear();
    });
  }, [transactions, selectedDate]);

  const totalIncome = currentMonthTransactions
    .filter(t => t.type === 'income' || t.type === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenditure = currentMonthTransactions
    .filter(t => t.type === 'expend' || t.type === 'Expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBalance = totalIncome - totalExpenditure;

  // === 4. Filter Transactions for Display ===
  const filteredTransactions = useMemo(() => {
    return currentMonthTransactions.filter(transaction => {
      // Filter by Type (All / Expend / Income)
      const matchesFilter = activeFilter === 'all' || 
                            (activeFilter === 'expend' && (transaction.type === 'expend' || transaction.type === 'Expense')) ||
                            (activeFilter === 'income' && (transaction.type === 'income' || transaction.type === 'Income'));
      
      // Filter by Search Query
      const description = transaction.description || "";
      const category = transaction.category || "";
      const matchesSearch = 
        description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesFilter && matchesSearch;
    });
  }, [currentMonthTransactions, activeFilter, searchQuery]);

  // Group transactions by Date for the list
  const getUniqueDates = () => {
    const dates = filteredTransactions.map(t => new Date(t.date).toDateString());
    return [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
  };

  const getTransactionsByDate = (dateString) => {
    return filteredTransactions.filter(t => 
      new Date(t.date).toDateString() === dateString
    );
  };

  // === Date Navigation ===
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

  // === Formatting ===
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

  // === Edit / Delete Logic ===
  const handleEditTransaction = (transaction) => {
    setEditingTransaction({
      ...transaction,
      // Ensure date is a string for TextInput (YYYY-MM-DD)
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* === Header Card === */}
        <LinearGradient colors={["#7e92edff", "#84aae7ff"]} style={styles.header}>
          <View style={styles.headerContent}>
            
            {/* Total Balance */}
            <View style={styles.balanceSection}>
              <Text style={styles.balanceAmount}>RM {totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
              <Text style={styles.balanceLabel}>Total Balance</Text>
            </View>
            
            {/* Date Navigation */}
            <View style={styles.dateSection}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.dateButton}>
                <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
                <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.dateButton}>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Income / Expense Summary */}
            <View style={styles.expenditureCard}>
              <View style={styles.expenditureRow}>
                <View style={styles.expenditureItem}>
                  <Text style={styles.expenditureLabel}>Income</Text>
                  <Text style={styles.incomeAmount}>RM {totalIncome.toLocaleString(undefined, {minimumFractionDigits: 0})}</Text>
                </View>
                <View style={[styles.divider, {backgroundColor: 'rgba(255,255,255,0.2)'}]} />
                <View style={styles.expenditureItem}>
                  <Text style={styles.expenditureLabel}>Expenses</Text>
                  <Text style={styles.expenseAmount}>RM {totalExpenditure.toLocaleString(undefined, {minimumFractionDigits: 0})}</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {/* === Controls: Search & Filter === */}
          <View style={styles.controlSection}>
            {!showSearch ? (
              <TouchableOpacity style={[styles.searchButton, { backgroundColor: colors.surface }]} onPress={() => setShowSearch(true)}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.onSurface} />
                <Text style={[styles.searchButtonText, { color: colors.onSurface }]}>Search transactions...</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.onSurface} />
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
              </View>
            )}
            
            <View style={styles.filterSection}>
              {[
                { key: 'all', label: 'All', icon: 'format-list-bulleted' }, 
                { key: 'expend', label: 'Expend', icon: 'trending-down' }, 
                { key: 'income', label: 'Income', icon: 'trending-up' }
              ].map((filter) => (
                <TouchableOpacity 
                  key={filter.key} 
                  style={[
                    styles.filterButton, 
                    { 
                      backgroundColor: activeFilter === filter.key ? colors.primary : colors.surface, 
                      borderColor: colors.primary 
                    }
                  ]} 
                  onPress={() => setActiveFilter(filter.key)}
                >
                  <MaterialCommunityIcons 
                    name={filter.icon} 
                    size={16} 
                    color={activeFilter === filter.key ? colors.surface : colors.primary} 
                  />
                  <Text style={[
                    styles.filterText, 
                    { color: activeFilter === filter.key ? colors.surface : colors.primary }
                  ]}>
                    {filter.label}
                  </Text>
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
                  <Text style={[styles.dateHeader, { color: colors.onSurface }]}>
                    {formatDisplayDate(dateObj)}
                  </Text>
                  
                  {dayTransactions.map(transaction => {
                    const isIncome = transaction.type === 'income' || transaction.type === 'Income';
                    const amountColor = isIncome ? '#4CAF50' : '#F44336';
                    
                    return (
                      <TouchableOpacity 
                        key={transaction.id} 
                        style={[styles.transactionItem, { backgroundColor: colors.surface }]} 
                        onPress={() => handleEditTransaction(transaction)}
                      >
                        <View style={[styles.transactionIcon, { backgroundColor: colors.primary + '20' }]}>
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
                          <Text style={[styles.transactionAmount, { color: amountColor }]}>
                            {isIncome ? '+' : '-'}RM {transaction.amount.toLocaleString()}
                          </Text>
                          <Text style={[styles.transactionTime, { color: colors.onSurface }]}>
                            {transaction.time}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
            
            {filteredTransactions.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={64} color={colors.onSurface} style={{opacity: 0.3}} />
                <Text style={[styles.emptyText, { color: colors.onSurface }]}>No transactions found</Text>
                <Text style={[styles.emptySubtext, { color: colors.onSurface }]}>Try changing the filter or date</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

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
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
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
                    { 
                      backgroundColor: (editingTransaction.type === 'income' || editingTransaction.type === 'Income') ? colors.primary : colors.surface 
                    }
                  ]}
                  onPress={() => setEditingTransaction({...editingTransaction, type: 'income'})}
                >
                  <Text style={[
                    styles.typeText, 
                    { color: (editingTransaction.type === 'income' || editingTransaction.type === 'Income') ? colors.surface : colors.primary }
                  ]}>Income</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton, 
                    { 
                      backgroundColor: (editingTransaction.type === 'expend' || editingTransaction.type === 'Expense') ? colors.primary : colors.surface 
                    }
                  ]}
                  onPress={() => setEditingTransaction({...editingTransaction, type: 'expend'})}
                >
                  <Text style={[
                    styles.typeText, 
                    { color: (editingTransaction.type === 'expend' || editingTransaction.type === 'Expense') ? colors.surface : colors.primary }
                  ]}>Expense</Text>
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.onSurface }]}>Amount (RM)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]}
                  value={editingTransaction.amount.toString()}
                  keyboardType="decimal-pad"
                  onChangeText={(text) => setEditingTransaction({ ...editingTransaction, amount: text })}
                />
              </View>

              {/* Category Grid */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
                {availableEditCategories.length === 0 && (
                   <Text style={{color: colors.onSurface, fontStyle: 'italic', marginBottom: 10, opacity: 0.6}}>
                     Select type to see categories...
                   </Text>
                )}
                <View style={styles.categoryGrid}>
                  {availableEditCategories.map((catName) => (
                    <TouchableOpacity
                      key={catName}
                      style={[
                        styles.categoryButton,
                        { 
                          backgroundColor: editingTransaction.category === catName ? colors.primary : colors.surface,
                          borderColor: colors.primary
                        }
                      ]}
                      onPress={() => setEditingTransaction({...editingTransaction, category: catName})}
                    >
                      <MaterialCommunityIcons 
                        name={getCategoryIcon(catName)} 
                        size={16} 
                        color={editingTransaction.category === catName ? colors.surface : colors.primary} 
                      />
                      <Text style={[
                        styles.categoryText,
                        { color: editingTransaction.category === catName ? colors.surface : colors.primary }
                      ]}>
                        {catName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.onSurface }]}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]}
                  value={editingTransaction.description}
                  multiline
                  numberOfLines={2}
                  onChangeText={(text) => setEditingTransaction({ ...editingTransaction, description: text })}
                />
              </View>

              {/* Date & Time */}
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={[styles.label, { color: colors.onSurface }]}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]}
                    value={editingTransaction.date}
                    onChangeText={(text) => setEditingTransaction({ ...editingTransaction, date: text })}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.onSurface }]}>Time (HH:MM)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]}
                    value={editingTransaction.time}
                    onChangeText={(text) => setEditingTransaction({ ...editingTransaction, time: text })}
                    placeholder="HH:MM"
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.deleteButton, { backgroundColor: '#FFEBEE', borderColor: '#F44336', borderWidth: 1 }]} onPress={handleDeleteTransaction}>
                  <MaterialCommunityIcons name="delete" size={20} color="#F44336" />
                  <Text style={[styles.deleteButtonText, {color: '#F44336'}]}>Delete</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={saveEditedTransaction}>
                  <MaterialCommunityIcons name="content-save" size={20} color={colors.surface} />
                  <Text style={[styles.saveButtonText, { color: colors.surface }]}>Save Changes</Text>
                </TouchableOpacity>
              </View>
              
              <View style={{height: 40}} /> 
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  header: { paddingTop: 50, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerContent: { alignItems: 'center' },
  balanceSection: { alignItems: 'center', marginBottom: 20 },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  dateSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dateButton: { padding: 8 },
  dateDisplay: { paddingHorizontal: 16 },
  dateText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  expenditureCard: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', width: '100%' },
  expenditureRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  expenditureItem: { alignItems: 'center', flex: 1 },
  divider: { width: 1, height: 30 },
  expenditureLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  incomeAmount: { fontSize: 16, fontWeight: 'bold', color: '#E8F5E8' },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#FFEBEE' },
  
  mainContent: { flex: 1, marginTop: -35 },
  
  controlSection: { paddingHorizontal: 16, marginBottom: 8, marginTop: 20 },
  searchButton: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 12, elevation: 4 },
  searchButtonText: { marginLeft: 8, fontSize: 14, opacity: 0.7 },
  searchBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 12, elevation: 4 },
  searchInput: { flex: 1, marginLeft: 8, marginRight: 8, fontSize: 14 },
  
  filterSection: { flexDirection: 'row', justifyContent: 'space-between' },
  filterButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, flex: 1, marginHorizontal: 4, justifyContent: 'center' },
  filterText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  
  transactionsSection: { paddingHorizontal: 16, flex: 1 },
  dateGroup: { marginBottom: 12 },
  dateHeader: { fontSize: 13, fontWeight: 'bold', marginVertical: 8, opacity: 0.7, letterSpacing: 0.5 },
  
  transactionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 8, elevation: 2 },
  transactionIcon: { padding: 10, borderRadius: 12, marginRight: 16 },
  transactionInfo: { flex: 1 },
  transactionCategory: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  transactionDescription: { fontSize: 12, opacity: 0.7 },
  transactionAmountSection: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  transactionTime: { fontSize: 11, opacity: 0.6 },
  
  emptyState: { alignItems: 'center', padding: 40, marginTop: 20 },
  emptyText: { fontSize: 18, textAlign: 'center', fontWeight: 'bold', marginTop: 16 },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 8, opacity: 0.6 },
  
  // Modal Styles
  modalContainer: { flex: 1, padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  editForm: { flex: 1 },
  
  typeSelector: { flexDirection: 'row', marginBottom: 20, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E0E0' },
  typeButton: { flex: 1, padding: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  typeText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  
  row: { flexDirection: 'row' },
  
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  categoryButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, margin: 4, borderRadius: 20, borderWidth: 1 },
  categoryText: { fontSize: 12, fontWeight: '500', marginLeft: 4 },
  
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, flex: 1, marginRight: 12, justifyContent: 'center' },
  deleteButtonText: { fontWeight: 'bold', marginLeft: 8 },
  saveButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, flex: 2, justifyContent: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
});