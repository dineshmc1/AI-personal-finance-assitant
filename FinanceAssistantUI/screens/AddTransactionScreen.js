// FinanceAssistantUI/screens/AddTransactionScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTransactions } from "../contexts/TransactionContext";
import { useNavigation } from "@react-navigation/native";

export default function AddTransactionScreen() {
  const { colors } = useTheme();
  // === 修改 1: 从 Context 获取真实的 categories 和 全局的 getCategoryIcon ===
  const { addTransaction, categories, getCategoryIcon } = useTransactions();
  const navigation = useNavigation();
  
  const [isSaving, setIsSaving] = useState(false);
  const [transaction, setTransaction] = useState({
    type: 'expend', // 注意：后端通常用 'Expense'，前端这里用 'expend' 对应 UI 逻辑，提交时需转换
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5)
  });

  // === 修改 2: 根据当前选择的 type (income/expend) 动态过滤分类 ===
  // 后端存的是 'Expense'/'Income' (大写开头)，前端 UI 状态是 'expend'/'income' (小写)
  const displayCategories = categories.filter(c => 
      (transaction.type === 'expend' && c.type === 'Expense') ||
      (transaction.type === 'income' && c.type === 'Income')
  );

  // 如果列表为空（刚注册没网时），提供默认兜底
  const fallbackCategories = transaction.type === 'expend' 
      ? ['Food', 'Transport', 'Shopping', 'Bills'] 
      : ['Salary', 'Freelance'];

  const finalCategoriesList = displayCategories.length > 0 
      ? displayCategories.map(c => c.name) 
      : fallbackCategories;

  // === 删除本地的 getCategoryIcon 函数，直接用 Context 里的 ===

  const handleSaveTransaction = async () => {
    if (!transaction.amount || !transaction.category) {
      Alert.alert('Error', 'Please fill in amount and category');
      return;
    }

    setIsSaving(true);
    try {
      const newTransaction = {
        type: transaction.type, // 'income' or 'expend'
        category: transaction.category,
        amount: parseFloat(transaction.amount),
        date: new Date(transaction.date),
        time: transaction.time,
        description: transaction.description || transaction.category, // 描述为空则用分类名
        icon: getCategoryIcon(transaction.category) // 使用 Context 函数
      };

      await addTransaction(newTransaction);
      
      // Reset form
      setTransaction({
        type: 'expend',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5)
      });
      
      Alert.alert(
        "Success!", 
        "Transaction added successfully!",
        [
          { text: "Add Another", style: "cancel" },
          { text: "Go to Home", onPress: () => navigation.navigate('MainRoot') } // 确保跳转正确
        ]
      );
      
    } catch (error) {
      Alert.alert('Error', 'Failed to save transaction');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.primary }]}>Add Transaction</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {/* Type Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Transaction Type</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                { 
                  backgroundColor: transaction.type === 'income' ? colors.primary : colors.surface,
                  borderColor: colors.primary
                }
              ]}
              onPress={() => setTransaction({...transaction, type: 'income', category: ''})} // 切换类型时清空已选分类
            >
              <MaterialCommunityIcons 
                name="trending-up" 
                size={20} 
                color={transaction.type === 'income' ? colors.surface : colors.primary} 
              />
              <Text style={[
                styles.typeText,
                { color: transaction.type === 'income' ? colors.surface : colors.primary }
              ]}>
                Income
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                { 
                  backgroundColor: transaction.type === 'expend' ? colors.primary : colors.surface,
                  borderColor: colors.primary
                }
              ]}
              onPress={() => setTransaction({...transaction, type: 'expend', category: ''})}
            >
              <MaterialCommunityIcons 
                name="trending-down" 
                size={20} 
                color={transaction.type === 'expend' ? colors.surface : colors.primary} 
              />
              <Text style={[
                styles.typeText,
                { color: transaction.type === 'expend' ? colors.surface : colors.primary }
              ]}>
                Expense
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Amount (RM)</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.surface, 
              color: colors.onSurface,
              borderColor: colors.outline
            }]}
            placeholder="0.00"
            placeholderTextColor={colors.onSurface + '80'}
            keyboardType="decimal-pad"
            value={transaction.amount}
            onChangeText={(text) => setTransaction({...transaction, amount: text})}
          />
        </View>

        {/* Category Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {finalCategoriesList.map((catName) => (
              <TouchableOpacity
                key={catName}
                style={[
                  styles.categoryButton,
                  { 
                    backgroundColor: transaction.category === catName ? colors.primary : colors.surface,
                    borderColor: colors.primary
                  }
                ]}
                onPress={() => setTransaction({...transaction, category: catName})}
              >
                <MaterialCommunityIcons 
                  name={getCategoryIcon(catName)} // 使用 Context 函数获取正确图标
                  size={16} 
                  color={transaction.category === catName ? colors.surface : colors.primary} 
                />
                <Text style={[
                  styles.categoryText,
                  { color: transaction.category === catName ? colors.surface : colors.primary }
                ]}>
                  {catName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, { 
              backgroundColor: colors.surface, 
              color: colors.onSurface,
              borderColor: colors.outline
            }]}
            placeholder="Enter description..."
            placeholderTextColor={colors.onSurface + '80'}
            multiline
            numberOfLines={3}
            value={transaction.description}
            onChangeText={(text) => setTransaction({...transaction, description: text})}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[
            styles.saveButton, 
            { 
              backgroundColor: isSaving ? '#CCCCCC' : colors.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center'
            }
          ]}
          onPress={handleSaveTransaction}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <MaterialCommunityIcons name="content-save" size={20} color={colors.surface} />
          )}
          <Text style={[styles.saveButtonText, { color: colors.surface, marginLeft: 8 }]}>
            {isSaving ? 'Saving...' : 'Save Transaction'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
  },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold' },
  placeholder: { width: 40 },
  form: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  typeSelector: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E0E0' },
  typeButton: { flex: 1, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1 },
  typeText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  categoryButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, margin: 4, borderRadius: 20, borderWidth: 1 },
  categoryText: { fontSize: 12, fontWeight: '500', marginLeft: 4 },
  saveButton: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 30 },
  saveButtonText: { fontSize: 16, fontWeight: 'bold' },
});