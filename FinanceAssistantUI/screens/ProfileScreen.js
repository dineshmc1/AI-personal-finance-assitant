// FinanceAssistantUI/screens/ProfileScreen.js
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from "react-native";
import { useTheme, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';

// 1. 引入 Auth 和 API
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/apiClient";

export default function ProfileScreen() {
  const { colors } = useTheme();
  
  // 2. 获取真实用户状态
  const { user, logout } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  
  // 后端测试状态
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState("");

  const [userData, setUserData] = useState({
    name: user?.displayName || "User", // 使用 Firebase 的名字
    email: user?.email || "No Email",  // 使用 Firebase 的邮箱
    phone: "+60 12-345 6789",
    monthlyIncome: 5000,
    savingsGoal: 1000,
    avatar: "https://cdn-icons-png.flaticon.com/512/149/149071.png"
  });

  const [tempData, setTempData] = useState(userData);

  // --- 3. 添加测试后端连接的函数 ---
  const handleTestBackend = async () => {
    setTestLoading(true);
    setTestResult("");
    try {
      // 调用 API 进行健康检查
      const response = await api.healthCheck();
      console.log("Backend response:", response);
      setTestResult(`✅ Connected! Status: ${response.status}`);
      Alert.alert("Success", "Backend connection established!");
    } catch (error) {
      console.error(error);
      setTestResult(`❌ Failed: ${error.message}`);
      Alert.alert("Error", "Could not connect to backend. Check connection.");
    } finally {
      setTestLoading(false);
    }
  };

  // --- 4. 添加登出函数 ---
  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: logout }
      ]
    );
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need gallery permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setUserData({...userData, avatar: result.assets[0].uri});
      }
    } catch (error) {
      console.log('Image picker error:', error);
    }
  };

  const handleSave = () => {
    setUserData(tempData);
    setIsEditing(false);
    Alert.alert("Success", "Profile updated successfully!");
  };

  const handleCancel = () => {
    setTempData(userData);
    setIsEditing(false);
  };

  const stats = [
    { label: "Total Transactions", value: "47", icon: "swap-horizontal" },
    { label: "Monthly Budget", value: "RM 2,600", icon: "cash" },
    { label: "Savings Rate", value: "18%", icon: "trending-up" },
    { label: "Goals Achieved", value: "3/5", icon: "target" },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.primary }]}>My Profile</Text>
        <TouchableOpacity 
          style={[styles.editButton, { backgroundColor: colors.primary }]}
          onPress={() => setIsEditing(!isEditing)}
        >
          <Text style={[styles.editButtonText, { color: colors.surface }]}>
            {isEditing ? "Cancel" : "Edit"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profile Section */}
      <View style={[styles.profileSection, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={isEditing ? pickImage : null}>
          <Image
            source={{ uri: userData.avatar }}
            style={styles.avatar}
          />
          {isEditing && (
            <View style={[styles.editOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <MaterialCommunityIcons name="camera" size={24} color="white" />
            </View>
          )}
        </TouchableOpacity>

        {isEditing ? (
          <View style={styles.editForm}>
            {/* Edit Fields */}
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface }]}
              value={tempData.name}
              onChangeText={(text) => setTempData({...tempData, name: text})}
              placeholder="Full Name"
            />
             {/* Disabled Email editing since it comes from Auth */}
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, opacity: 0.6 }]}
              value={tempData.email}
              editable={false} 
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface }]}
              value={tempData.phone}
              onChangeText={(text) => setTempData({...tempData, phone: text})}
              placeholder="Phone Number"
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface }]}
              value={tempData.monthlyIncome.toString()}
              onChangeText={(text) => setTempData({...tempData, monthlyIncome: parseFloat(text) || 0})}
              placeholder="Monthly Income"
              keyboardType="decimal-pad"
            />
            
            <View style={styles.saveButtons}>
              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
                onPress={handleCancel}
              >
                <Text style={[styles.saveButtonText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Text style={[styles.saveButtonText, { color: colors.surface }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.onSurface }]}>{userData.name}</Text>
            <Text style={[styles.email, { color: colors.onSurface }]}>{userData.email}</Text>
            <Text style={[styles.uid, { color: colors.onSurface }]}>ID: {user?.uid?.slice(0,8)}...</Text>
            
            <View style={styles.financialInfo}>
              <View style={styles.financialItem}>
                <Text style={[styles.financialLabel, { color: colors.onSurface }]}>Monthly Income</Text>
                <Text style={[styles.financialValue, { color: colors.primary }]}>RM {userData.monthlyIncome}</Text>
              </View>
              <View style={styles.financialItem}>
                <Text style={[styles.financialLabel, { color: colors.onSurface }]}>Savings Goal</Text>
                <Text style={[styles.financialValue, { color: colors.primary }]}>RM {userData.savingsGoal}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Quick Stats */}
      <View style={styles.statsSection}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Quick Stats</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View key={index} style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name={stat.icon} size={24} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.onSurface }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.onSurface }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.settingsSection}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Account Settings</Text>
        
        {/* 1. Privacy & Security */}
        <TouchableOpacity style={[styles.settingItem, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="shield-account" size={24} color={colors.primary} />
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.onSurface }]}>Privacy & Security</Text>
            <Text style={[styles.settingDesc, { color: colors.onSurface }]}>Manage your account security</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurface} />
        </TouchableOpacity>

        {/* 2. Notifications (已加回) */}
        <TouchableOpacity style={[styles.settingItem, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="bell" size={24} color={colors.primary} />
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.onSurface }]}>Notifications</Text>
            <Text style={[styles.settingDesc, { color: colors.onSurface }]}>Configure alert preferences</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurface} />
        </TouchableOpacity>

        {/* 3. Data & Reports (已加回) */}
        <TouchableOpacity style={[styles.settingItem, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="chart-box" size={24} color={colors.primary} />
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.onSurface }]}>Data & Reports</Text>
            <Text style={[styles.settingDesc, { color: colors.onSurface }]}>View your financial reports</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurface} />
        </TouchableOpacity>

        {/* --- SYSTEM CHECK BUTTON --- */}
        <TouchableOpacity 
          style={[styles.settingItem, { backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: 'orange' }]}
          onPress={handleTestBackend}
          disabled={testLoading}
        >
          <MaterialCommunityIcons name="server-network" size={24} color="orange" />
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: colors.onSurface }]}>
              Test Backend Connection
            </Text>
            <Text style={[styles.settingDesc, { color: testResult.includes('Failed') ? 'red' : 'green' }]}>
              {testLoading ? "Connecting..." : (testResult || "Tap to check server status")}
            </Text>
          </View>
          {testLoading && <ActivityIndicator size="small" color="orange" />}
        </TouchableOpacity>

        {/* --- LOGOUT BUTTON --- */}
        <TouchableOpacity 
          style={[styles.settingItem, { backgroundColor: colors.surface, marginTop: 10, borderLeftWidth: 4, borderLeftColor: 'red' }]}
          onPress={handleLogout}
        >
          <MaterialCommunityIcons name="logout" size={24} color="red" />
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: "red" }]}>Sign Out</Text>
            <Text style={[styles.settingDesc, { color: colors.onSurface }]}>Log out from your account</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="red" />
        </TouchableOpacity>

      </View>
      <View style={{height: 40}} /> 
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 20,
    marginTop: 10
  },
  title: { fontSize: 24, fontWeight: "bold" },
  editButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  editButtonText: { fontSize: 14, fontWeight: "600" },
  profileSection: { 
    borderRadius: 12, 
    padding: 20, 
    alignItems: "center", 
    marginBottom: 20,
    elevation: 3 
  },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 15 },
  editOverlay: { 
    position: "absolute", 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    borderRadius: 50, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  profileInfo: { alignItems: "center" },
  name: { fontSize: 22, fontWeight: "bold", marginBottom: 5 },
  email: { fontSize: 16, marginBottom: 3, opacity: 0.8 },
  uid: { fontSize: 12, marginBottom: 10, opacity: 0.5 }, // Added UID style
  phone: { fontSize: 14, marginBottom: 15, opacity: 0.7 },
  financialInfo: { flexDirection: "row", marginTop: 10 },
  financialItem: { alignItems: "center", marginHorizontal: 15 },
  financialLabel: { fontSize: 12, marginBottom: 5 },
  financialValue: { fontSize: 16, fontWeight: "bold" },
  editForm: { width: "100%" },
  input: { 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 10, 
    fontSize: 16 
  },
  saveButtons: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginTop: 10 
  },
  saveButton: { 
    flex: 1, 
    padding: 12, 
    borderRadius: 8, 
    alignItems: "center", 
    marginHorizontal: 5,
    borderWidth: 1 
  },
  saveButtonText: { fontSize: 16, fontWeight: "600" },
  statsSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  statCard: { 
    width: "48%", 
    padding: 15, 
    borderRadius: 12, 
    alignItems: "center", 
    marginBottom: 10,
    elevation: 2 
  },
  statValue: { fontSize: 18, fontWeight: "bold", marginVertical: 5 },
  statLabel: { fontSize: 12, textAlign: "center" },
  settingsSection: { marginBottom: 20 },
  settingItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: 15, 
    borderRadius: 8, 
    marginBottom: 10,
    elevation: 2 
  },
  settingInfo: { flex: 1, marginLeft: 15 },
  settingTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  settingDesc: { fontSize: 12, opacity: 0.7 },
});



