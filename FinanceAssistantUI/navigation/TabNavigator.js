// navigation/TabNavigator.js
import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";

import HomeScreen from "../screens/HomeScreen";
import DashboardScreen from "../screens/DashboardScreen";
import UploadScreen from "../screens/UploadScreen";
import GoalsScreen from "../screens/GoalsScreen";

const Tab = createBottomTabNavigator();

export default function TabNavigator({ navigation }) {
  const theme = useTheme();
  
  return (
    <Tab.Navigator
          screenOptions={{
            headerShown: true,
            headerStyle: {
              backgroundColor: '#7e92edff',
              height: 70,
              elevation: 0,
              shadowOpacity: 0,
            },
            headerTitleStyle: {
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.onSurface,
            },
            headerTitleAlign: 'center',
            headerLeft: () => (
              <MaterialCommunityIcons
                name="menu"
                size={28}
                color={theme.colors.onSurface}
                style={{ marginLeft: 15 }}
                onPress={() => navigation.toggleDrawer()}
              />
            ),
            tabBarStyle: { 
              backgroundColor: theme.colors.surface,
              height: 60,
              paddingBottom: 6,
              paddingTop: 6,
              borderTopWidth: 0,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            },
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.onSurface,
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '500',
              marginTop: 2,
            },
          }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
          headerTitle: "",
        }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" color={color} size={size} />
          ),
          headerTitle: "",
        }}
      />
      <Tab.Screen
        name="Add"
        component={UploadScreen}
        options={{
          tabBarLabel: "",
          headerTitle: "",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={[
              styles.addButton,
              { 
                backgroundColor: focused ? theme.colors.primary : theme.colors.primary,
                shadowColor: theme.colors.primary,
              }
            ]}>
              <MaterialCommunityIcons 
                name="plus" 
                color={theme.colors.surface} 
                size={28} 
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="target" color={color} size={size} />
          ),
          headerTitle: "",
        }}
      />
      <Tab.Screen
        name="Chat"
        component={GoalsScreen} // Use a valid component as placeholder
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat" color={color} size={size} />
          ),
          headerTitle: "Chat",
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Chat'); // Navigate to standalone Chat screen
          },
        }}
      />
    </Tab.Navigator>
  );
}

const styles = {
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20, // Adjusted margin
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};