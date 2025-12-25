// navigation/TabNavigator.js
import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

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
        headerBackground: () => (
          <LinearGradient
            colors={["#00f3ff20", "#8a2be220"]} // Glassy Neon Cyan to Purple
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        ),
        headerStyle: {
          // Background color is handled by headerBackground, but we need to ensure height/transparency
          backgroundColor: 'transparent',
          height: 70, // Keep height
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#fff', // White text for contrast on gradient
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: "bold",
          textShadowColor: 'rgba(0,0,0,0.3)',
          textShadowRadius: 5
        },
        headerTitleAlign: 'center',

        // Sidebar Menu Button
        headerLeft: () => (
          <MaterialCommunityIcons
            name="menu"
            size={28}
            color="#fff"
            style={{ marginLeft: 15 }}
            onPress={() => navigation.toggleDrawer()}
          />
        ),

        // Tab Bar Styling (Glassy Dark)
        tabBarStyle: {
          backgroundColor: theme.colors.background, // Match app background
          borderTopColor: theme.colors.primary, // Thin neon line on top?
          borderTopWidth: 1, // Subtle border
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurface + '80', // Semi-transparent white
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
          headerShown: false,
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
          headerShown: false,
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
          headerShown: false,
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