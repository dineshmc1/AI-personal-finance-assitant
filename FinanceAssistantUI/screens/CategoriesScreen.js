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
  RefreshControl,
  StatusBar,
  Animated
} from "react-native";
import { useRef } from "react";
import AnimatedHeader from "../components/AnimatedHeader";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTransactions } from "../contexts/TransactionContext";
import GlassCard from "../components/GlassCard";

export default function CategoriesScreen({ navigation }) {
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
  const scrollY = useRef(new Animated.Value(0)).current;

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
        color: "#" + Math.floor(Math.random() * 16777215).toString(16)
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <AnimatedHeader
        title="Categories"
        scrollY={scrollY}
        navigation={navigation}
      />
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={[{ flexGrow: 1, paddingBottom: 20 }, { paddingTop: 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <Text style={[styles.title, { color: colors.primary, textShadowColor: colors.primary, textShadowRadius: 10 }]}>Categories</Text>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "expense" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab("expense")}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === "expense" ? colors.primary : colors.onSurface }
            ]}>
              Expenses
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "income" && { borderBottomColor: colors.secondary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab("income")}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === "income" ? colors.secondary : colors.onSurface }
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
              style={{ width: "48%", marginBottom: 15 }}
              onPress={() => Alert.alert("Category", `${category.name}\n\nLong press to delete.`)}
              onLongPress={() => handleDeleteCategory(category)}
              delayLongPress={500}
              activeOpacity={0.7}
            >
              <GlassCard style={{ alignItems: 'center', padding: 20 }}>
                <View style={[styles.iconContainer, { backgroundColor: (category.color || colors.primary) + '20', borderColor: (category.color || colors.primary), borderWidth: 1 }]}>
                  <MaterialCommunityIcons name={category.icon} size={32} color={category.color || colors.primary} />
                </View>
                <Text style={[styles.categoryName, { color: colors.onSurface }]}>{category.name}</Text>
              </GlassCard>
            </TouchableOpacity>
          ))}

          {currentCategories.length === 0 && (
            <Text style={{ textAlign: 'center', width: '100%', marginTop: 20, color: colors.onSurface, opacity: 0.7 }}>
              No categories found. Add one below!
            </Text>
          )}
        </View>

        {/* Add Category Button */}
        <TouchableOpacity
          onPress={() => setShowAddCategory(true)}
          style={{ marginBottom: 20 }}
        >
          <GlassCard style={[styles.addButton, { borderColor: colors.primary }]}>
            <MaterialCommunityIcons name="plus" size={24} color={colors.primary} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Category</Text>
          </GlassCard>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </Animated.ScrollView>

      {/* Add Category Modal - Moved OUTSIDE ScrollView */}
      {
        showAddCategory && (
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modal}>
              <Text style={[styles.modalTitle, { color: colors.primary }]}>Add New Category</Text>

              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.onSurface, borderColor: colors.outline }]}
                placeholder="Category Name"
                placeholderTextColor={colors.onSurface + '80'}
                value={newCategory.name}
                onChangeText={(text) => setNewCategory({ ...newCategory, name: text })}
              />

              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newCategory.type === "expense" && { backgroundColor: colors.primary + '30', borderColor: colors.primary, borderWidth: 1 }
                  ]}
                  onPress={() => setNewCategory({ ...newCategory, type: "expense" })}
                >
                  <Text style={[
                    styles.typeText,
                    { color: newCategory.type === "expense" ? colors.primary : colors.onSurface }
                  ]}>
                    Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newCategory.type === "income" && { backgroundColor: colors.secondary + '30', borderColor: colors.secondary, borderWidth: 1 }
                  ]}
                  onPress={() => setNewCategory({ ...newCategory, type: "income" })}
                >
                  <Text style={[
                    styles.typeText,
                    { color: newCategory.type === "income" ? colors.secondary : colors.onSurface }
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
                      newCategory.icon === icon && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primary + '20' }
                    ]}
                    onPress={() => setNewCategory({ ...newCategory, icon })}
                  >
                    <MaterialCommunityIcons
                      name={icon}
                      size={24}
                      color={newCategory.icon === icon ? colors.primary : colors.onSurface}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { borderColor: colors.outline, borderWidth: 1 }]}
                  onPress={() => setShowAddCategory(false)}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddCategory}
                >
                  <Text style={[styles.modalButtonText, { color: colors.background, fontWeight: 'bold' }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginVertical: 20, letterSpacing: 1 },
  tabContainer: { flexDirection: "row", marginBottom: 25 },
  tab: { flex: 1, padding: 15, alignItems: "center", borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  tabText: { fontSize: 16, fontWeight: "600" },
  categoriesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  iconContainer: { padding: 12, borderRadius: 25, marginBottom: 12 },
  categoryName: { fontSize: 14, fontWeight: "600", textAlign: "center", letterSpacing: 0.5 },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed' },
  addButtonText: { fontSize: 16, fontWeight: "600", marginLeft: 8 },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { width: '90%', padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20, fontSize: 16 },
  typeSelector: { flexDirection: "row", marginBottom: 20, gap: 10 },
  typeButton: { flex: 1, padding: 15, alignItems: "center", borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  typeText: { fontSize: 14, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 10 },
  iconsScroll: { marginBottom: 20 },
  iconOption: { padding: 12, borderRadius: 12, marginRight: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  modalButtons: { flexDirection: "row", gap: 15 },
  modalButton: { flex: 1, padding: 15, borderRadius: 12, alignItems: "center" },
  modalButtonText: { fontSize: 16, fontWeight: "600" },
});