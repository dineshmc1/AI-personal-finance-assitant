// navigation/MainNavigator.js
import React, { useState } from "react";
import { NavigationContainer, DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from "react-native-paper";
import DrawerNavigator from "./DrawerNavigator";
import LoadingScreen from "../screens/LoadingScreen";
import ChatScreen from "../screens/ChatScreen";
import LoginScreen from "../screens/LoginScreen";
import CalendarScreen from "../screens/CalendarScreen";
import TwinScreen from "../screens/TwinScreen";
import ForecastScreen from "../screens/ForecastScreen";
import { StatusBar } from "react-native";

import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";

const { DarkTheme } = adaptNavigationTheme({
  reactNavigationDark: NavigationDarkTheme,
});

const { LightTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
});

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  const { isAuthenticated, initializing } = useAuth();
  const { isDarkMode } = useSettings();
  const [currentScreen, setCurrentScreen] = useState("Loading");

  const FuturisticTheme = {
    ...MD3DarkTheme,
    ...DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      ...DarkTheme.colors,
      primary: "#00f3ff", // Neon Cyan
      onPrimary: "#000000",
      secondary: "#bc13fe", // Neon Pink
      onSecondary: "#ffffff",
      tertiary: "#8a2be2", // Electric Purple
      background: "#0a0e17", // Deep Navy/Black
      surface: "#111625", // Dark Blue-Gray Surface
      surfaceVariant: "#1c2333", // Slightly lighter surface
      onSurface: "#e0e6ed", // Off-white text
      outline: "#2a3b55", // Blue-ish outline
      elevation: {
        level1: "#111625",
        level2: "#161b2c",
        level3: "#1c2333",
        level4: "#212b3f",
        level5: "#28344b",
      }
    },
    roundness: 16,
  };

  const FuturisticLightTheme = {
    ...MD3LightTheme,
    ...LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      ...LightTheme.colors,
      primary: "#00BCD4", // Cyan 500
      onPrimary: "#ffffff",
      secondary: "#9C27B0", // Purple 500
      onSecondary: "#ffffff",
      tertiary: "#673AB7", // Deep Purple
      background: "#F5F7FA", // Light grey-blueish background
      surface: "#FFFFFF", // Pure white surface
      surfaceVariant: "#E1E5EA", // Light gray
      onSurface: "#1A202C", // Dark text
      outline: "#CBD5E0",
      elevation: {
        level1: "#FFFFFF",
        level2: "#F8F9FA",
        level3: "#F1F3F5",
        level4: "#ECEEF0",
        level5: "#E9ECEF",
      }
    },
    roundness: 16,
  };

  const activeTheme = isDarkMode ? FuturisticTheme : FuturisticLightTheme;

  if (initializing) {
    return (
      <PaperProvider theme={activeTheme}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={activeTheme.colors.background} />
        <LoadingScreen />
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={activeTheme}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={activeTheme.colors.background} />
      <NavigationContainer theme={activeTheme}>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          screenListeners={{
            state: (e) => {
              if (e?.data?.state?.routes?.[e.data.state.index]) {
                const routeName = e.data.state.routes[e.data.state.index].name;
                setCurrentScreen(routeName);
              }
            }
          }}
        >
          {isAuthenticated ? (
            <>
              <Stack.Screen name="MainRoot" component={DrawerNavigator} />

              <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={{ headerShown: false }}
              />

              <Stack.Screen
                name="Calendar"
                component={CalendarScreen}
                options={{ headerShown: false }}
              />

              <Stack.Screen
                name="Twin"
                component={TwinScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Forecast"
                component={ForecastScreen}
                options={{ headerShown: false }}
              />
            </>
          ) : (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ animationTypeForReplace: 'pop' }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}