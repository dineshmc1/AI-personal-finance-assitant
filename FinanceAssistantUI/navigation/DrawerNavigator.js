// navigation/DrawerNavigator.js
import React from "react";
import { View } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";

import TabNavigator from "./TabNavigator";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ReportsScreen from "../screens/ReportsScreen";
import BudgetScreen from "../screens/BudgetScreen";
import CategoriesScreen from "../screens/CategoriesScreen";
import ExportScreen from "../screens/ExportScreen";
import ForecastScreen from "../screens/ForecastScreen";
import SimulationScreen from "../screens/SimulationScreen";

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  const theme = useTheme();

  return (
    <Drawer.Navigator
      screenOptions={({ navigation }) => ({
        headerBackground: () => (
          <LinearGradient
            colors={["#00f3ff20", "#8a2be220"]} // Glassy Neon Cyan to Purple
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        ),
        headerTintColor: '#000', // Black text on bright neon header for contrast? Or White on dark?
        // Wait, Cyan/Purple gradient is bright. Text should probably be Black or White with shadow.
        // Let's try White text, but maybe verify contrast.
        // Actually, let's stick to a DARK gradient for the header to match the app? 
        // User asked "can we make it looks nicer". The Home screen uses Cyan-Purple. 
        // Let's match the Home screen header: Cyan-Purple.
        // If background is Cyan-Purple, text should be White or Black.
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: "bold",
          textShadowColor: 'rgba(0,0,0,0.3)',
          textShadowRadius: 5
        },
        headerStyle: {
          height: 80, // Taller header?
          backgroundColor: 'transparent',
          borderBottomWidth: 0,
          elevation: 0,
          shadowOpacity: 0
        },
        headerRightContainerStyle: { paddingRight: 10 },
        headerLeftContainerStyle: { paddingLeft: 10 },
        headerTitleAlign: 'center',

        headerLeft: () => (
          <MaterialCommunityIcons
            name="menu"
            size={28}
            color="#fff"
            style={{ marginLeft: 15 }}
            onPress={() => navigation.toggleDrawer()}
          />
        ),
        drawerStyle: {
          backgroundColor: theme.colors.background, // Deep Navy
          width: 280,
          borderRightColor: theme.colors.primary,
          borderRightWidth: 1,
        },
        drawerContentContainerStyle: {
          flex: 1,
          paddingTop: 50,
        },
        drawerItemStyle: {
          marginVertical: 5,
          borderRadius: 12,
          marginHorizontal: 10,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)'
        },
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.onSurface,
        drawerLabelStyle: {
          fontSize: 15,
          fontWeight: "600",
          marginLeft: -10,
        },
        drawerActiveBackgroundColor: theme.colors.primary + '20',
        swipeEnabled: true,
      })}
    >
      <Drawer.Screen
        name="DrawerHome"
        component={TabNavigator}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
          title: "Home",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="Budget"
        component={BudgetScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cash" color={color} size={size} />
          ),
          title: "Budget Planning",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="format-list-bulleted" color={color} size={size} />
          ),
          title: "Expense Categories",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" color={color} size={size} />
          ),
          title: "My Profile",
          headerShown: false,
        }}
      />

      {/* Optimization Reports */}
      <Drawer.Screen
        name="Optimization"
        component={ReportsScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-line-variant" color={color} size={size} />
          ),
          title: "Portfolio Optimization",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="Forecast"
        component={ForecastScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bell-curve" color={color} size={size} />
          ),
          title: "Future Balance",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="Simulation"
        component={SimulationScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="crystal-ball" color={color} size={size} />
          ),
          title: "What-If Simulator",
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
          title: "Settings",
          headerShown: false,
        }}
      />
    </Drawer.Navigator>
  );
}