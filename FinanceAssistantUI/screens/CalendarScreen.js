import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl, 
  Modal, 
  TextInput, 
  Alert,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTransactions } from '../contexts/TransactionContext';
import { apiRequest } from '../services/apiClient'; 

export default function CalendarScreen({ navigation }) {
  const { colors } = useTheme();
  const { calendarEvents, loadCalendarEvents } = useTransactions();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshing, setRefreshing] = useState(false);
  
  // === Modal State ===
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // 判断是新增还是编辑
  const [editingId, setEditingId] = useState(null); // 编辑时的 Bill ID

  const [billForm, setBillForm] = useState({
    name: "",
    amount: "",
    next_due_date: new Date().toISOString().split('T')[0],
    frequency: "Monthly",
    category: "Housing"
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCalendarEvents();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCalendarEvents();
    setRefreshing(false);
  };

  // === 1. 打开新增窗口 ===
  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setBillForm({
      name: "",
      amount: "",
      next_due_date: selectedDate,
      frequency: "Monthly",
      category: "Housing"
    });
    setShowModal(true);
  };

  // === 2. 打开编辑窗口 (修复版) ===
  const openEditModal = (event) => {
    // 只有用户手动添加的 "User Bill" 才能编辑，自动检测的不可编辑
    if (event.type !== 'User Bill') {
      Alert.alert("Info", "This is an automatically detected recurring payment. You cannot edit it manually here.");
      return;
    }
    
    // 必须有 ID 才能编辑
    if (!event.id) {
      Alert.alert("Error", "Cannot edit this bill (Missing ID). Try deleting it instead.");
      return;
    }

    setIsEditing(true);
    setEditingId(event.id);
    setBillForm({
      name: event.name.split(' (RM')[0], // 简单处理一下名字，去掉 "(RM xxx)"
      amount: Math.abs(event.amount).toString(),
      next_due_date: event.event_date || selectedDate, // 使用事件日期作为下次到期日
      frequency: "Monthly", // 默认，如果 API 返回了 frequency 更好
      category: "Housing"
    });
    setShowModal(true);
  };

  // === 3. 处理保存 (Create & Update) ===
  const handleSaveBill = async () => {
    if (!billForm.name || !billForm.amount) {
      Alert.alert("Error", "Please fill in name and amount.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: billForm.name,
        amount: parseFloat(billForm.amount),
        next_due_date: billForm.next_due_date,
        frequency: billForm.frequency,
        category: "Housing"
      };

      if (isEditing && editingId) {
        // === Update (PUT) ===
        await apiRequest(`/calendar/bill/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        Alert.alert("Success", "Bill updated successfully!");
      } else {
        // === Create (POST) ===
        await apiRequest('/calendar/bill', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        Alert.alert("Success", "Bill added successfully!");
      }

      setShowModal(false);
      await loadCalendarEvents(); // 刷新列表
    } catch (error) {
      console.error(error);
      Alert.alert("Error", `Failed to ${isEditing ? 'update' : 'save'} bill.`);
    } finally {
      setIsSaving(false);
    }
  };

  // === 4. 处理删除 (Delete) ===
  const handleDeleteBill = (event) => {
    if (event.type !== 'User Bill') return;

    Alert.alert(
      "Delete Bill",
      `Are you sure you want to delete "${event.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
             if (!event.id) {
                 Alert.alert("Error", "Bill ID missing, cannot delete.");
                 return;
             }
             
             try {
                await apiRequest(`/calendar/bill/${event.id}`, { method: 'DELETE' });
                Alert.alert("Deleted", "Bill deleted successfully.");
                loadCalendarEvents(); // 刷新
             } catch(e) { 
                 console.error(e);
                 Alert.alert("Error", "Failed to delete bill."); 
             }
          }
        }
      ]
    );
  };

  // 格式化标记点
  const markedDates = useMemo(() => {
    const marks = {};
    if (calendarEvents) {
      Object.keys(calendarEvents).forEach(date => {
        const events = calendarEvents[date];
        let dotColor = colors.primary;
        if (events.some(e => e.type === 'Bill Due' || e.type === 'User Bill')) dotColor = '#F44336';
        else if (events.some(e => e.type === 'Income Expected')) dotColor = '#4CAF50';

        marks[date] = { marked: true, dotColor: dotColor };
      });
    }
    marks[selectedDate] = { 
      ...(marks[selectedDate] || {}), 
      selected: true, 
      selectedColor: colors.primary 
    };
    return marks;
  }, [calendarEvents, selectedDate, colors]);

  const selectedEvents = calendarEvents[selectedDate] || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 8}}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Financial Calendar</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Calendar
          current={selectedDate}
          onDayPress={day => {
            setSelectedDate(day.dateString);
            // 只有在新增模式下，点击日期才自动填充日期
            if (!isEditing) {
                setBillForm(prev => ({ ...prev, next_due_date: day.dateString }));
            }
          }}
          markedDates={markedDates}
          theme={{
            backgroundColor: colors.surface,
            calendarBackground: colors.surface,
            textSectionTitleColor: colors.onSurface,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: '#ffffff',
            todayTextColor: colors.primary,
            dayTextColor: colors.onSurface,
            textDisabledColor: '#d9e1e8',
            arrowColor: colors.primary,
            monthTextColor: colors.onSurface,
            textMonthFontWeight: 'bold',
          }}
        />

        <View style={styles.eventsContainer}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            Events on {selectedDate}
          </Text>
          
          {selectedEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="calendar-blank" size={48} color={colors.onSurface} style={{ opacity: 0.3 }} />
              <Text style={{ textAlign: 'center', marginTop: 10, color: colors.onSurface, opacity: 0.6 }}>
                No bills or income expected.
              </Text>
              <Text style={{ fontSize: 12, color: colors.primary, marginTop: 5 }}>
                Tap "+" to add a bill.
              </Text>
            </View>
          ) : (
            selectedEvents.map((event, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.eventCard, { backgroundColor: colors.surface }]}
                onLongPress={() => handleDeleteBill(event)}
                onPress={() => openEditModal(event)}
                delayLongPress={500}
              >
                <View style={[styles.iconBox, { 
                    backgroundColor: event.amount < 0 ? '#FFEBEE' : '#E8F5E8' 
                }]}>
                  <MaterialCommunityIcons 
                    name={event.amount < 0 ? "file-document-outline" : "cash-plus"} 
                    size={24} 
                    color={event.amount < 0 ? "#F44336" : "#4CAF50"} 
                  />
                </View>
                <View style={{flex: 1}}>
                    <Text style={[styles.eventName, { color: colors.onSurface }]}>{event.name}</Text>
                    <Text style={{fontSize: 12, opacity: 0.6, color: colors.onSurface}}>
                        {event.type} {event.source ? `• ${event.source}` : ''}
                    </Text>
                </View>
                <Text style={[styles.eventAmount, { 
                    color: event.amount < 0 ? "#F44336" : "#4CAF50" 
                }]}>
                  {event.amount < 0 ? '-' : '+'}RM {Math.abs(event.amount).toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
        <View style={{height: 80}} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={openAddModal}
      >
        <MaterialCommunityIcons name="plus" size={28} color="white" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>
                {isEditing ? "Edit Bill" : "Add Recurring Bill"}
            </Text>
            
            <Text style={[styles.label, { color: colors.onSurface }]}>Bill Name</Text>
            <TextInput 
              style={[styles.input, { color: colors.onSurface, borderColor: colors.outline || '#ccc' }]}
              placeholder="e.g. Netflix, Rent"
              placeholderTextColor={colors.onSurface + '80'}
              value={billForm.name}
              onChangeText={t => setBillForm({...billForm, name: t})}
            />

            <Text style={[styles.label, { color: colors.onSurface }]}>Amount (RM)</Text>
            <TextInput 
              style={[styles.input, { color: colors.onSurface, borderColor: colors.outline || '#ccc' }]}
              placeholder="0.00"
              placeholderTextColor={colors.onSurface + '80'}
              keyboardType="decimal-pad"
              value={billForm.amount.toString()}
              onChangeText={t => setBillForm({...billForm, amount: t})}
            />

            <Text style={[styles.label, { color: colors.onSurface }]}>First Due Date</Text>
            <TextInput 
              style={[styles.input, { color: colors.onSurface, borderColor: colors.outline || '#ccc' }]}
              value={billForm.next_due_date}
              placeholder="YYYY-MM-DD"
              onChangeText={t => setBillForm({...billForm, next_due_date: t})}
            />

            <Text style={[styles.label, { color: colors.onSurface }]}>Frequency</Text>
            <View style={styles.frequencyRow}>
              {["Monthly", "Annually"].map(freq => (
                <TouchableOpacity 
                  key={freq}
                  style={[
                    styles.freqButton, 
                    { 
                      backgroundColor: billForm.frequency === freq ? colors.primary : colors.surface,
                      borderColor: colors.primary
                    }
                  ]}
                  onPress={() => setBillForm({...billForm, frequency: freq})}
                >
                  <Text style={{ color: billForm.frequency === freq ? 'white' : colors.primary }}>{freq}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: '#f0f0f0' }]} 
                onPress={() => setShowModal(false)}
              >
                <Text style={{ color: 'black' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.primary }]} 
                onPress={handleSaveBill}
                disabled={isSaving}
              >
                <Text style={{ color: 'white' }}>{isSaving ? "Saving..." : "Save Bill"}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, elevation: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  eventsContainer: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
  eventCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 2 },
  iconBox: { padding: 10, borderRadius: 10, marginRight: 15 },
  eventName: { fontSize: 16, fontWeight: '500' },
  eventAmount: { fontSize: 16, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 40, opacity: 0.8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalContent: { borderRadius: 16, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  frequencyRow: { flexDirection: 'row', marginTop: 5 },
  freqButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginRight: 10 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
  modalButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
});