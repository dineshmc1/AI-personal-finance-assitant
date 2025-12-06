// navigation/MainNavigator.js
import React, { useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider as PaperProvider, MD3LightTheme, adaptNavigationTheme } from "react-native-paper";
import DrawerNavigator from "./DrawerNavigator";
import LoadingScreen from "../screens/LoadingScreen";
import ChatScreen from "../screens/ChatScreen";
import { useAuth } from "../contexts/AuthContext";
import LoginScreen from "../screens/LoginScreen";

const { LightTheme } = adaptNavigationTheme({
  reactNavigationLight: DefaultTheme,
});

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  // 2. 获取认证状态
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

  // 3. 如果正在初始化 (检查 Firebase 本地 token 中)，显示 Loading
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
              // 这里的保护逻辑：防止报错，有时候 state 可能是 undefined
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
              {/*<Stack.Screen name="Home" component={DrawerNavigator} />*/}
              <Stack.Screen name="MainRoot" component={DrawerNavigator} />
              <Stack.Screen 
                name="Chat" 
                component={ChatScreen}
                options={{
                  headerShown: false, 
                  // 如果 Chat 需要特定的转场动画可以在这里加
                }}
              />
            </>
          ) : (
            // --- 这里的页面只有【没登录】时才能看到 ---
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
              // 当用户登出时，动画效果设为 pop 或 fade 会更自然
              options={{ animationTypeForReplace: 'pop' }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
// const { LightTheme } = adaptNavigationTheme({
//   reactNavigationLight: DefaultTheme,
// });

// const Stack = createNativeStackNavigator();

// export default function MainNavigator() {
//   const [currentScreen, setCurrentScreen] = useState("Loading");

//   const CombinedLightTheme = {
//     ...MD3LightTheme,
//     ...LightTheme,
//     colors: {
//       ...MD3LightTheme.colors,
//       ...LightTheme.colors,
//       primary: "#5588f8ff",
//       background: "#f5f6fa",
//       surface: "#ffffff",
//       onSurface: "#000000",
//     },
//   };

//   return (
//     <PaperProvider theme={CombinedLightTheme}>
//       <NavigationContainer theme={CombinedLightTheme}>
//         <Stack.Navigator 
//           screenOptions={{ headerShown: false }}
//           screenListeners={{
//             state: (e) => {
//               const routeName = e.data.state.routes[e.data.state.index].name;
//               setCurrentScreen(routeName);
//             }
//           }}
//         >
//           <Stack.Screen name="Loading" component={LoadingScreen} />
//           <Stack.Screen name="Home" component={DrawerNavigator} />
//           <Stack.Screen 
//             name="Chat" 
//             component={ChatScreen}
//             options={{
//               headerShown: false,
//             }}
//           />
//         </Stack.Navigator>
//       </NavigationContainer>
//     </PaperProvider>
//   );
// }