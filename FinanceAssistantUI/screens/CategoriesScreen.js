// screens/CategoriesScreen.js
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  RefreshControl 
} from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTransactions } from "../contexts/TransactionContext";

export default function CategoriesScreen() {
  const { colors } = useTheme();
  
  const { 
    categories: allCategories, 
    addCategory: addCategoryContext, 
    deleteCategory: deleteCategoryContext,
    loadCategories 
  } = useTransactions();

  const [activeTab, setActiveTab] = useState("expense");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", type: "expense", icon: "tag" });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  const currentCategories = allCategories.filter(c => 
      (activeTab === 'expense' && c.type === 'Expense') || 
      (activeTab === 'income' && c.type === 'Income')
  );

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      Alert.alert("Error", "Please enter a category name");
      return;
    }
    
    try {
        await addCategoryContext({
            name: newCategory.name,
            type: newCategory.type, 
            icon: newCategory.icon,
            color: "#" + Math.floor(Math.random()*16777215).toString(16) 
        });
        
        Alert.alert("Success", "Category added!");
        setNewCategory({ name: "", type: "expense", icon: "tag" });
        setShowAddCategory(false);
    } catch (error) {
        Alert.alert("Error", "Failed to add category.");
    }
  };

  const handleDeleteCategory = (category) => {
    
    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteCategoryContext(category.id);
            } catch (error) {
              Alert.alert("Cannot Delete", "Default categories cannot be deleted.");
            }
          }
        }
      ]
    );
  };

  const icons = ["food", "car", "shopping", "file-document", "movie", "hospital", "cash", "laptop", "chart-line", "gift", "airplane", "gamepad", "tag", "home", "school", "piggy-bank"];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.title, { color: colors.primary }]}>Categories</Text>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: activeTab === "expense" ? colors.primary : colors.surface }
          ]}
          onPress={() => setActiveTab("expense")}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === "expense" ? colors.surface : colors.primary }
          ]}>
            Expenses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: activeTab === "income" ? colors.primary : colors.surface }
          ]}
          onPress={() => setActiveTab("income")}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === "income" ? colors.surface : colors.primary }
          ]}>
            Income
          </Text>
        </TouchableOpacity>
      </View>

      {/* Categories Grid */}
      <View style={styles.categoriesGrid}>
        {currentCategories.map((category) => (
          <TouchableOpacity 
            key={category.id} 
            style={[styles.categoryCard, { backgroundColor: colors.surface }]}
            onLongPress={() => handleDeleteCategory(category)} // === 长按删除 ===
            delayLongPress={500}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: (category.color || colors.primary) + "20" }]}>
              <MaterialCommunityIcons name={category.icon} size={24} color={category.color || colors.primary} />
            </View>
            <Text style={[styles.categoryName, { color: colors.onSurface }]}>{category.name}</Text>
            
          </TouchableOpacity>
        ))}
        
        {currentCategories.length === 0 && (
            <Text style={{textAlign: 'center', width: '100%', marginTop: 20, opacity: 0.5}}>
                No categories found. Add one below!
            </Text>
        )}
      </View>

      {/* Add Category Button */}
      <TouchableOpacity 
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowAddCategory(true)}
      >
        <MaterialCommunityIcons name="plus" size={24} color={colors.surface} />
        <Text style={[styles.addButtonText, { color: colors.surface }]}>Add Category</Text>
      </TouchableOpacity>

      {/* Add Category Modal */}
      {showAddCategory && (
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <Text style={[styles.modalTitle, { color: colors.primary }]}>Add New Category</Text>
          
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]}
            placeholder="Category Name"
            placeholderTextColor={colors.onSurface + '80'}
            value={newCategory.name}
            onChangeText={(text) => setNewCategory({...newCategory, name: text})}
          />
          
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                { backgroundColor: newCategory.type === "expense" ? colors.primary : colors.surface }
              ]}
              onPress={() => setNewCategory({...newCategory, type: "expense"})}
            >
              <Text style={[
                styles.typeText,
                { color: newCategory.type === "expense" ? colors.surface : colors.primary }
              ]}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                { backgroundColor: newCategory.type === "income" ? colors.primary : colors.surface }
              ]}
              onPress={() => setNewCategory({...newCategory, type: "income"})}
            >
              <Text style={[
                styles.typeText,
                { color: newCategory.type === "income" ? colors.surface : colors.primary }
              ]}>
                Income
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.onSurface }]}>Select Icon:</Text>
          <ScrollView horizontal style={styles.iconsScroll} showsHorizontalScrollIndicator={false}>
            {icons.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconOption,
                  { backgroundColor: newCategory.icon === icon ? colors.primary : colors.surface, borderColor: '#eee', borderWidth: 1 }
                ]}
                onPress={() => setNewCategory({...newCategory, icon})}
              >
                <MaterialCommunityIcons 
                  name={icon} 
                  size={20} 
                  color={newCategory.icon === icon ? colors.surface : colors.primary} 
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: colors.surface }]}
              onPress={() => setShowAddCategory(false)}
            >
              <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleAddCategory}
            >
              <Text style={[styles.modalButtonText, { color: colors.surface }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Bottom Padding */}
      <View style={{height: 50}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginVertical: 15 },
  tabContainer: { flexDirection: "row", marginBottom: 20, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: '#eee' },
  tab: { flex: 1, padding: 15, alignItems: "center" },
  tabText: { fontSize: 16, fontWeight: "600" },
  categoriesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  categoryCard: { width: "48%", padding: 15, borderRadius: 12, alignItems: "center", marginBottom: 10, elevation: 2 },
  iconContainer: { padding: 10, borderRadius: 20, marginBottom: 8 },
  categoryName: { fontSize: 14, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  categoryAmount: { fontSize: 12, fontWeight: "500" },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 15, borderRadius: 8, marginBottom: 20 },
  addButtonText: { fontSize: 16, fontWeight: "600", marginLeft: 8 },
  modal: { position: "absolute", top: 50, left: 20, right: 20, borderRadius: 12, padding: 20, elevation: 5, borderWidth: 1, borderColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
  typeSelector: { flexDirection: "row", marginBottom: 15, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: '#eee' },
  typeButton: { flex: 1, padding: 12, alignItems: "center" },
  typeText: { fontSize: 14, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  iconsScroll: { marginBottom: 15 },
  iconOption: { padding: 10, borderRadius: 8, marginRight: 8 },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: "center", marginHorizontal: 5 },
  modalButtonText: { fontSize: 16, fontWeight: "600" },
});