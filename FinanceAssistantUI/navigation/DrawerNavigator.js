// navigation/DrawerNavigator.js
import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";

import TabNavigator from "./TabNavigator";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ReportsScreen from "../screens/ReportsScreen";
import BudgetScreen from "../screens/BudgetScreen";
import CategoriesScreen from "../screens/CategoriesScreen";
import ExportScreen from "../screens/ExportScreen";
import GoalsScreen from "../screens/GoalsScreen"; // Add this import

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  const theme = useTheme();
  
  return (
    <Drawer.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: { 
          backgroundColor: theme.colors.surface,
          height: 50,
        },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: "600",
        },
        headerLeft: () => (
          <MaterialCommunityIcons
            name="menu"
            size={28}
            color={theme.colors.onSurface}
            style={{ marginLeft: 15 }}
            onPress={() => navigation.toggleDrawer()}
          />
        ),
        drawerStyle: { 
          backgroundColor: theme.colors.surface,
          width: 280,
        },
        drawerContentContainerStyle: {
          flex: 1,
        },
        drawerItemStyle: {
          marginVertical: 2,
          borderRadius: 8,
          marginHorizontal: 8,
        },
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.onSurface,
        drawerLabelStyle: { 
          fontSize: 14, 
          fontWeight: "500",
          marginLeft: -8,
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
        }}
      />
    </Drawer.Navigator>
  );
}