import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform 
} from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ProgressBar from "../components/ProgressBar"; 
import { useTransactions } from "../contexts/TransactionContext";
import { apiRequest } from '../services/apiClient';

export default function BudgetScreen() {
  const { colors } = useTheme();
  const { 
    budgets, 
    addBudget, 
    updateBudget, 
    loadBudgets, 
    deleteBudget, 
    categories 
  } = useTransactions();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [newBudget, setNewBudget] = useState({ category: "", allocated: "", period: "Monthly" });
  const [refreshing, setRefreshing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    loadBudgets();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBudgets();
    setRefreshing(false);
  };

  const totalAllocated = budgets.reduce((sum, b) => sum + (b.allocated || 0), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
  const totalRemaining = totalAllocated - totalSpent;

  const openAddModal = () => {
      setEditingId(null);
      setNewBudget({ category: "", allocated: "", period: "Monthly" });
      setShowModal(true);
  };

  const openEditModal = (budget) => {
      setEditingId(budget.id);
      setNewBudget({
          category: budget.category,
          allocated: String(budget.allocated),
          period: budget.period || "Monthly"
      });
      setShowModal(true);
  };

  const handleAutoFill = async () => {
    if (!newBudget.category) {
      Alert.alert("Select Category", "Please select a category first so AI can analyze it.");
      return;
    }

    setAiLoading(true);
    try {
        const result = await apiRequest("/reports/budget/auto");
        const suggestion = result.budget_allocation.find(b => b.category === newBudget.category);
        
        if (suggestion) {
            setNewBudget({ ...newBudget, allocated: suggestion.amount.toString() });
            Alert.alert(
                "✨ AI Suggestion", 
                `Based on your history, AI suggests a monthly budget of RM ${suggestion.amount} for ${newBudget.category}.`
            );
        } else {
            Alert.alert("AI Suggestion", "Not enough data to suggest a budget for this category.");
        }
    } catch (e) {
        console.error(e);
        Alert.alert("Error", "AI is currently unavailable.");
    } finally {
        setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newBudget.category || !newBudget.allocated) {
      Alert.alert("Error", "Please select a category and enter amount");
      return;
    }

    try {
      if (editingId) {
          await updateBudget(editingId, {
              category: newBudget.category, 
              allocated: newBudget.allocated,
              period: newBudget.period
          });
          Alert.alert("Success", "Budget updated successfully!");
      } else {
          // --- Create Mode ---
          const exists = budgets.find(b => b.category === newBudget.category);
          if (exists) {
              Alert.alert("Error", "Budget for this category already exists. Tap it to edit.");
              return;
          }

          await addBudget({
            category: newBudget.category,
            allocated: newBudget.allocated,
            period: newBudget.period
          });
          Alert.alert("Success", "Budget created successfully!");
      }
      setShowModal(false);
      setNewBudget({ category: "", allocated: "", period: "Monthly" });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", `Failed to ${editingId ? 'update' : 'create'} budget.`);
    }
  };

  const handleDeleteBudget = (budget) => {
    Alert.alert(
      "Delete Budget",
      `Are you sure you want to delete the budget for "${budget.category}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBudget(budget.id);
            } catch (error) {
              Alert.alert("Error", "Failed to delete budget");
            }
          }
        }
      ]
    );
  };

  const expenseCategories = categories.filter(c => c.type === 'Expense').map(c => c.name);
  const availableCategories = expenseCategories.length > 0 ? expenseCategories : ["Food", "Transport", "Shopping", "Bills", "Entertainment"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.title, { color: colors.primary }]}>Budget Management</Text>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.onSurface }]}>Total Limit</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>RM {totalAllocated.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.onSurface }]}>Spent</Text>
              <Text style={[styles.summaryValue, { color: totalSpent > totalAllocated ? "#F44336" : colors.primary }]}>
                RM {totalSpent.toFixed(0)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.onSurface }]}>Remaining</Text>
              <Text style={[styles.summaryValue, { color: totalRemaining < 0 ? "#F44336" : "#4CAF50" }]}>
                RM {totalRemaining.toFixed(0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.budgetList}>
          {budgets.map((budget) => {
            const progress = budget.allocated > 0 ? budget.spent / budget.allocated : 0;
            const isOverBudget = budget.remaining < 0;
            
            const safeLimitText = budget.period === 'Monthly' 
                ? `Weekly Safe Limit: RM ${(budget.dailyLimit * 7).toFixed(0)}`
                : `Daily Safe Limit: RM ${budget.dailyLimit.toFixed(0)}`;

            return (
              <TouchableOpacity
                  key={budget.id} 
                  style={[styles.budgetItem, { backgroundColor: colors.surface }]}
                  onPress={() => openEditModal(budget)} 
                  onLongPress={() => handleDeleteBudget(budget)} 
                  activeOpacity={0.7}
                  delayLongPress={500}
              >
                <View style={styles.budgetHeader}>
                  <View style={styles.categoryInfo}>
                    <View style={[styles.colorDot, { backgroundColor: budget.color || colors.primary }]} />
                    <Text style={[styles.categoryName, { color: colors.onSurface }]}>
                      {budget.category} 
                      <Text style={{fontSize: 12, opacity: 0.6, fontWeight: 'normal'}}> ({budget.period})</Text>
                    </Text>
                  </View>
                  <Text style={[styles.remaining, { color: isOverBudget ? "#F44336" : colors.onSurface }]}>
                    {isOverBudget ? `Over: RM ${Math.abs(budget.remaining).toFixed(0)}` : `Left: RM ${budget.remaining.toFixed(0)}`}
                  </Text>
                </View>
                
                <ProgressBar 
                  progress={Math.min(progress, 1)} 
                  color={isOverBudget ? "#F44336" : (budget.color || colors.primary)} 
                />
                
                <View style={styles.budgetDetails}>
                  <Text style={[styles.amount, { color: colors.onSurface }]}>
                    {Math.round(progress * 100)}% Used
                  </Text>
                  {budget.remaining > 0 && (
                      <Text style={[styles.percentage, { color: colors.primary }]}>
                      {safeLimitText}
                      </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          
          {budgets.length === 0 && (
              <Text style={{textAlign: 'center', marginTop: 20, opacity: 0.5, color: colors.onSurface}}>
                  No budgets set. Tap "+" to create one.
              </Text>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={openAddModal}
      >
        <MaterialCommunityIcons name="plus" size={24} color={colors.surface} />
        <Text style={[styles.addButtonText, { color: colors.surface }]}>Create Budget</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
        >
            <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.outline }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>
                {editingId ? "Edit Budget" : "New Budget"}
            </Text>
            
            <View style={styles.periodSelector}>
                <TouchableOpacity 
                    style={[styles.periodButton, { backgroundColor: newBudget.period === 'Monthly' ? colors.primary : colors.surface }]}
                    onPress={() => setNewBudget({...newBudget, period: 'Monthly'})}
                >
                    <Text style={{color: newBudget.period === 'Monthly' ? 'white' : colors.primary, fontWeight: '600'}}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.periodButton, { backgroundColor: newBudget.period === 'Weekly' ? colors.primary : colors.surface }]}
                    onPress={() => setNewBudget({...newBudget, period: 'Weekly'})}
                >
                    <Text style={{color: newBudget.period === 'Weekly' ? 'white' : colors.primary, fontWeight: '600'}}>Weekly</Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.label, {color: colors.onSurface}]}>
                Category {editingId ? "(Locked)" : ":"}
            </Text>
            <ScrollView horizontal style={{marginBottom: 15, maxHeight: 50}} showsHorizontalScrollIndicator={false}>
                {availableCategories.map(cat => {
                    const isSelected = newBudget.category === cat;
                    if (editingId && !isSelected) return null;

                    return (
                        <TouchableOpacity 
                            key={cat} 
                            disabled={!!editingId} 
                            style={[
                                styles.categoryChip, 
                                { 
                                    backgroundColor: isSelected ? colors.primary : colors.surface, 
                                    borderColor: colors.primary,
                                    opacity: (editingId && isSelected) ? 0.8 : 1 
                                }
                            ]}
                            onPress={() => setNewBudget({...newBudget, category: cat})}
                        >
                            <Text style={{color: isSelected ? colors.surface : colors.primary}}>{cat}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
            
            <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]}
                placeholder="Limit Amount (RM)"
                placeholderTextColor={colors.onSurface}
                keyboardType="decimal-pad"
                value={newBudget.allocated}
                onChangeText={(text) => setNewBudget({...newBudget, allocated: text})}
            />

            {!editingId && (
                <TouchableOpacity 
                    onPress={handleAutoFill} 
                    style={{alignSelf: 'flex-end', marginBottom: 20, padding: 5}}
                    disabled={aiLoading}
                >
                    <Text style={{color: colors.primary, fontWeight: '600'}}>
                        {aiLoading ? "Thinking..." : "✨ Auto-fill with AI"}
                    </Text>
                </TouchableOpacity>
            )}
            
            <View style={styles.modalButtons}>
                <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline }]}
                onPress={() => setShowModal(false)}
                >
                <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSubmit}
                >
                <Text style={[styles.modalButtonText, { color: colors.surface }]}>
                    {editingId ? "Update" : "Save"}
                </Text>
                </TouchableOpacity>
            </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginVertical: 15 },
  summaryCard: { borderRadius: 12, padding: 20, marginBottom: 20, elevation: 3, marginHorizontal: 5 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: 12, marginBottom: 5 },
  summaryValue: { fontSize: 16, fontWeight: "bold" },
  budgetList: { marginBottom: 20 },
  budgetItem: { borderRadius: 12, padding: 15, marginBottom: 10, elevation: 2, marginHorizontal: 5 },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  categoryInfo: { flexDirection: "row", alignItems: "center" },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  categoryName: { fontSize: 16, fontWeight: "600" },
  remaining: { fontSize: 14, fontWeight: "600" },
  budgetDetails: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  amount: { fontSize: 12 },
  percentage: { fontSize: 12, fontWeight: "600" },

  addButton: { 
      position: 'absolute', 
      bottom: 20, 
      alignSelf: 'center', 
      flexDirection: "row", 
      alignItems: "center", 
      justifyContent: "center", 
      paddingVertical: 12,
      paddingHorizontal: 24, 
      borderRadius: 30, 
      elevation: 5 
  },
  addButtonText: { fontSize: 16, fontWeight: "600", marginLeft: 8 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalContent: { borderRadius: 15, padding: 20, elevation: 5, borderWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 16 },
  modalButtons: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: "center", marginHorizontal: 5 },
  modalButtonText: { fontSize: 16, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8, minWidth: 60, alignItems: 'center' },
  periodSelector: { flexDirection: 'row', marginBottom: 15, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  periodButton: { flex: 1, padding: 10, alignItems: 'center' }
});