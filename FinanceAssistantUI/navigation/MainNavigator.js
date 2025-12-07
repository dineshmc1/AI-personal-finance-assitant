// navigation/MainNavigator.js
import React, { useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider as PaperProvider, MD3LightTheme, adaptNavigationTheme } from "react-native-paper";
import DrawerNavigator from "./DrawerNavigator";
import LoadingScreen from "../screens/LoadingScreen";
import ChatScreen from "../screens/ChatScreen";
import LoginScreen from "../screens/LoginScreen";
// 👇 1. 在这里引入 CalendarScreen
import CalendarScreen from "../screens/CalendarScreen"; 
import TwinScreen from "../screens/TwinScreen";

import { useAuth } from "../contexts/AuthContext";

const { LightTheme } = adaptNavigationTheme({
  reactNavigationLight: DefaultTheme,
});

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  const { isAuthenticated, initializing } = useAuth();
  const [currentScreen, setCurrentScreen] = useState("Loading");

  const CombinedLightTheme = {
    ...MD3LightTheme,
    ...LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      ...LightTheme.colors,
      primary: "#5588f8ff",
      background: "#f5f6fa",
      surface: "#ffffff",
      onSurface: "#000000",
    },
  };

  if (initializing) {
    return (
      <PaperProvider theme={CombinedLightTheme}>
        <LoadingScreen />
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={CombinedLightTheme}>
      <NavigationContainer theme={CombinedLightTheme}>
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
            // --- 这里的页面只有登录后才能看到 ---
            <>
              <Stack.Screen name="MainRoot" component={DrawerNavigator} />
              
              <Stack.Screen 
                name="Chat" 
                component={ChatScreen}
                options={{ headerShown: false }}
              />

              {/* 👇 2. 在这里添加 Calendar 路由 */}
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
            </>
          ) : (
            // --- 这里的页面只有【没登录】时才能看到 ---
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