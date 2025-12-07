import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from "expo-linear-gradient";
import ProgressBar from "../components/ProgressBar";
import { useTransactions } from "../contexts/TransactionContext";

export default function GoalsScreen() {
  const { colors } = useTheme();
  const { 
    goals, 
    addGoal: createGoalContext, 
    updateGoalProgress, 
    getCurrentBalance, 
    loadGoals, 
    deleteGoal,
    categories,     
    getCategoryIcon   
  } = useTransactions();
  
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showEditAmount, setShowEditAmount] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [amountToEdit, setAmountToEdit] = useState("");
  
  const [newGoal, setNewGoal] = useState({
    title: "",
    targetAmount: "",
    currentAmount: "",
    deadline: null,
    category: "Savings" 
  });

  useEffect(() => {
    loadGoals();
  }, []);

  const availableCategories = categories.length > 0 
      ? categories.map(c => c.name) 
      : ["Savings", "Travel", "Vehicle", "Housing", "Education", "Investments", "Other"]; // Fallback

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return "RM 0";
    return `RM ${amount.toLocaleString()}`;
  };

  const hasSufficientBalance = (amount) => {
    const currentBalance = getCurrentBalance();
    return currentBalance >= amount;
  };

  const handleAddGoal = async () => {
    if (!newGoal.title || !newGoal.targetAmount) {
      Alert.alert("Error", "Please fill in goal title and target amount");
      return;
    }

    if (!newGoal.deadline) {
        Alert.alert("Error", "Please select a target date");
        return;
    }

    const target = parseFloat(newGoal.targetAmount) || 0;
    const current = parseFloat(newGoal.currentAmount) || 0;
    
    if (current > target) {
      Alert.alert("Error", "Current amount cannot be greater than target amount");
      return;
    }

    if (current > 0 && !hasSufficientBalance(current)) {
      Alert.alert("Insufficient Funds", `Current balance: RM ${getCurrentBalance()}`);
      return;
    }

    try {
        await createGoalContext({
            title: newGoal.title,
            targetAmount: target,
            currentAmount: current,
            deadline: newGoal.deadline,
            category: newGoal.category 
        });
        
        Alert.alert("Success", "Goal added successfully!");
        setShowAddGoal(false);
        setNewGoal({ title: "", targetAmount: "", currentAmount: "", deadline: null, category: "Savings" });

    } catch (error) {
        Alert.alert("Error", "Failed to save goal.");
    }
  };

  // === Delete Logic ===
  const handleDeleteGoal = (id) => {
    Alert.alert(
      "Delete Goal",
      "Are you sure you want to delete this goal? Saved amount will be refunded to your balance.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
                await deleteGoal(id);
                Alert.alert("Deleted", "Goal removed and funds refunded.");
            } catch (error) {
                Alert.alert("Error", "Failed to delete goal.");
            }
          }
        }
      ]
    );
  };

  // === Update Progress Logic ===
  const quickUpdate = (id, amount) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    
    if (amount < 0 && goal.currentAmount < Math.abs(amount)) {
         Alert.alert("Error", "Cannot withdraw more than saved amount.");
         return;
    }
    if (amount > 0 && !hasSufficientBalance(amount)) {
       Alert.alert("Insufficient Funds", `Balance: RM ${getCurrentBalance()}`);
       return;
    }

    const action = amount > 0 ? "Deposit" : "Withdraw";
    const absAmount = Math.abs(amount);
    
    Alert.alert(
        `${action} from Goal`,
        `${action} RM ${absAmount} for ${goal.title}?`,
        [
            { text: "Cancel", style: "cancel" },
            { text: "Confirm", onPress: () => updateGoalProgress(id, amount) }
        ]
    );
  };

  const openEditModal = (goal) => {
      setSelectedGoal(goal);
      setAmountToEdit(""); 
      setShowEditAmount(true);
  };

  const handleCustomUpdate = () => {
      if (!selectedGoal || !amountToEdit) return;
      const amount = parseFloat(amountToEdit);
      if (isNaN(amount) || amount === 0) {
          Alert.alert("Error", "Please enter a valid amount.");
          return;
      }
      setShowEditAmount(false);
      quickUpdate(selectedGoal.id, amount); 
  };
  
  const getProgressColor = (progress, completed) => {
    if (completed || progress >= 1) return "#4CAF50";
    if (progress >= 0.7) return "#2196F3";
    if (progress >= 0.4) return "#FF9800";
    return "#F44336";
  };
  
  const getDaysRemaining = (deadline) => {
    if (!deadline) return null;
    const today = new Date();
    const targetDate = new Date(deadline);
    const diffTime = targetDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "No deadline";
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "Select target date";
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };
  
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setNewGoal({ ...newGoal, deadline: selectedDate.toISOString().split('T')[0] });
    }
  };

  // Update existing functions to use quickUpdate
  const subtractFromGoal = (id, amount) => quickUpdate(id, -amount);
  const addToGoal = (id, amount) => quickUpdate(id, amount);


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["#7e92edff", "#84aae7ff"]} style={styles.headerGradient}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Financial Goals</Text>
            <Text style={styles.subtitle}>Track and achieve your dreams</Text>
          </View>
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
            onPress={() => setShowAddGoal(true)}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="target" size={20} color={colors.primary} />
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{goals.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.onSurface }]}>Total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{goals.filter(g => g.completed).length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.onSurface }]}>Done</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="progress-clock" size={20} color={colors.primary} />
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{goals.filter(g => !g.completed).length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.onSurface }]}>Active</Text>
          </View>
        </View>

        {/* Goals List */}
        {goals.map((goal) => {
          const daysRemaining = goal.deadline ? getDaysRemaining(goal.deadline) : null;
          const progressColor = getProgressColor(goal.progress, goal.completed);
          
          return (
            <View key={goal.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: goal.completed ? '#4CAF50' : 'transparent', borderWidth: goal.completed ? 2 : 0 }]}>
              <View style={styles.goalHeader}>
                <View style={styles.goalTitleSection}>
                  <Text style={[styles.goalTitle, { color: colors.onSurface }]}>{goal.title}</Text>
                  <View style={styles.categoryRow}>
                    {/* === 使用 getCategoryIcon 获取动态图标 === */}
                    <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '20', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <MaterialCommunityIcons 
                        name={getCategoryIcon(goal.category)} 
                        size={14} 
                        color={colors.primary} 
                      />
                      <Text style={[styles.categoryText, { color: colors.primary }]}>{goal.category || "Goal"}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteGoal(goal.id)}>
                  <MaterialCommunityIcons name="delete-outline" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.amountSection}>
                  <View style={styles.amountInfo}>
                    <Text style={[styles.currentAmount, { color: progressColor }]}>{formatCurrency(goal.currentAmount)}</Text>
                    <Text style={[styles.targetAmount, { color: progressColor + 'CC' }]}>of {formatCurrency(goal.targetAmount)}</Text>
                  </View>
                  <View style={styles.percentageSection}>
                    <Text style={[styles.percentage, { color: progressColor }]}>{Math.round(goal.progress * 100)}%</Text>
                  </View>
                </View>
                <ProgressBar progress={Math.min(1, goal.progress)} color={progressColor} />
                <View style={styles.goalInfo}>
                  {goal.deadline && (
                    <View style={styles.infoItem}>
                      <MaterialCommunityIcons name="calendar-clock" size={14} color={colors.onSurface} />
                      <Text style={[styles.infoText, { color: colors.onSurface }]}>
                        {daysRemaining > 0 ? `${daysRemaining} days left` : 'Deadline passed'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.actionSection}>
                <View style={styles.controlsRow}>
                  <TouchableOpacity style={[styles.controlButton, { backgroundColor: '#FFEBEE' }]} onPress={() => subtractFromGoal(goal.id, 100)}>
                    <MaterialCommunityIcons name="minus" size={16} color="#F44336" />
                    <Text style={[styles.controlButtonText, { color: "#F44336" }]}>100</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.controlButton, { backgroundColor: colors.primary + '15' }]} onPress={() => openEditModal(goal)}>
                    <MaterialCommunityIcons name="pencil" size={16} color={colors.primary} />
                    <Text style={[styles.controlButtonText, { color: colors.primary }]}>Any Amount</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.controlButton, { backgroundColor: '#E8F5E8' }]} onPress={() => addToGoal(goal.id, 100)}>
                    <MaterialCommunityIcons name="plus" size={16} color="#4CAF50" />
                    <Text style={[styles.controlButtonText, { color: "#4CAF50" }]}>100</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {goals.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="target" size={80} color={colors.onSurface + '80'} />
            <Text style={[styles.emptyText, { color: colors.onSurface }]}>No goals yet</Text>
            <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={() => setShowAddGoal(true)}>
              <Text style={[styles.emptyButtonText, { color: colors.surface }]}>Create Your First Goal</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal visible={showAddGoal} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>Create New Goal</Text>
            <TouchableOpacity onPress={() => setShowAddGoal(false)}>
              <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.onSurface }]}>Goal Title</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface }]} placeholder="e.g., Emergency Fund" placeholderTextColor={colors.onSurface + '80'} value={newGoal.title} onChangeText={(text) => setNewGoal({...newGoal, title: text})} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.onSurface }]}>Target Amount (RM)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface }]} placeholder="10000" placeholderTextColor={colors.onSurface + '80'} keyboardType="decimal-pad" value={newGoal.targetAmount} onChangeText={(text) => setNewGoal({...newGoal, targetAmount: text})} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.onSurface }]}>Current Amount (RM)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface }]} placeholder="0" placeholderTextColor={colors.onSurface + '80'} keyboardType="decimal-pad" value={newGoal.currentAmount} onChangeText={(text) => setNewGoal({...newGoal, currentAmount: text})} />
            </View>
            
            {/* === Grid === */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {availableCategories.map((category) => (
                  <TouchableOpacity 
                    key={category}
                    style={[
                      styles.categoryOption,
                      { 
                        backgroundColor: newGoal.category === category ? colors.primary : colors.surface,
                        borderColor: colors.primary
                      }
                    ]}
                    onPress={() => setNewGoal({...newGoal, category})}
                  >
                    <Text style={[
                      styles.categoryOptionText,
                      { color: newGoal.category === category ? colors.surface : colors.primary }
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.onSurface }]}>Target Date</Text>
              <TouchableOpacity style={[styles.datePickerButton, { backgroundColor: colors.surface }]} onPress={() => setShowDatePicker(true)}>
                <MaterialCommunityIcons name="calendar" size={20} color={colors.primary} />
                <Text style={[styles.datePickerText, { color: colors.onSurface }]}>{formatDateForDisplay(newGoal.deadline)}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleAddGoal}>
              <Text style={[styles.saveButtonText, { color: colors.surface }]}>Create Goal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Amount Modal  */}
      <Modal visible={showEditAmount} animationType="fade" transparent>
        <View style={styles.editAmountOverlay}>
          <View style={[styles.editAmountModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.editAmountTitle, { color: colors.onSurface }]}>Add / Withdraw</Text>
            <Text style={[styles.editAmountSubtitle, { color: colors.onSurface }]}>{selectedGoal?.title}</Text>
            <Text style={[styles.editAmountNote, { color: colors.onSurface }]}>Use negative (-) to withdraw.</Text>
            
            <TextInput
              style={[styles.amountInput, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.primary }]}
              placeholder="+100 or -50"
              placeholderTextColor={colors.onSurface + '80'}
              keyboardType="default"
              value={amountToEdit}
              onChangeText={setAmountToEdit}
              autoFocus
            />
            
            <View style={styles.editAmountButtons}>
              <TouchableOpacity style={[styles.editAmountButton, { backgroundColor: colors.surface }]} onPress={() => setShowEditAmount(false)}>
                <Text style={[styles.editAmountButtonText, { color: colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editAmountButton, { backgroundColor: colors.primary }]} onPress={handleCustomUpdate}>
                <Text style={[styles.editAmountButtonText, { color: colors.surface }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker && <DateTimePicker value={new Date()} mode="date" display="spinner" onChange={handleDateChange} minimumDate={new Date()} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingTop: 25, paddingBottom: 50, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  headerTextContainer: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, opacity: 0.8, marginTop: 2, color: '#fff' },
  addButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  scrollView: { flex: 1, marginTop: -20 },
  scrollContent: { paddingBottom: 20 },
  summaryCard: { flexDirection: 'row', margin: 16, padding: 20, borderRadius: 16, elevation: 4 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: '#E0E0E0' },
  summaryLabel: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  summaryValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  card: { margin: 16, marginVertical: 8, padding: 20, borderRadius: 16, elevation: 2 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  goalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  goalTitleSection: { flex: 1 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  categoryText: { fontSize: 10, fontWeight: '600' },
  statusText: { fontSize: 11, fontWeight: '600', fontStyle: 'italic' },
  deleteButton: { padding: 4 },
  progressSection: { marginBottom: 16 },
  amountSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  amountInfo: { flex: 1 },
  percentageSection: { alignItems: 'flex-end' },
  currentAmount: { fontSize: 20, fontWeight: 'bold' },
  targetAmount: { fontSize: 14, opacity: 0.7 },
  percentage: { fontSize: 16, fontWeight: 'bold' },
  goalInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 11, opacity: 0.7 },
  actionSection: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 16 },
  controlsRow: { flexDirection: 'row', gap: 8 },
  controlButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  controlButtonText: { fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 40, marginTop: 20 },
  emptyText: { fontSize: 20, fontWeight: 'bold', marginTop: 16 },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 8, opacity: 0.7 },
  emptyButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  emptyButtonText: { fontSize: 14, fontWeight: '600' },
  modalContainer: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  modalContent: { flex: 1 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, padding: 16, fontSize: 16 },
  datePickerButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, padding: 16, gap: 12 },
  datePickerText: { fontSize: 16, flex: 1 },
  clearDateButton: { padding: 8 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  categoryOptionText: { fontSize: 14, fontWeight: '500' },
  saveButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveButtonText: { fontSize: 16, fontWeight: 'bold' },
  editAmountOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  editAmountModal: { width: '100%', padding: 24, borderRadius: 16, elevation: 8 },
  editAmountTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  editAmountSubtitle: { fontSize: 14, textAlign: 'center', opacity: 0.7, marginBottom: 8 },
  editAmountNote: { fontSize: 12, textAlign: 'center', opacity: 0.7, marginBottom: 16 },
  amountInput: { borderWidth: 2, borderRadius: 12, padding: 16, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  editAmountButtons: { flexDirection: 'row', gap: 12 },
  editAmountButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  editAmountButtonText: { fontSize: 16, fontWeight: '600' },
  bottomPadding: { height: 20 },
});