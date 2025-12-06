// screens/LoadingScreen.js
import React, { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function LoadingScreen({ navigation }) {
  const { colors } = useTheme();

  useEffect(() => {
    // Simulate loading process (3 seconds)
    const timer = setTimeout(() => {
      navigation.replace("Home"); // Navigate to Home after loading
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <View style={styles.logoContainer}>
        {/* App Icon */}
        <MaterialCommunityIcons 
          name="finance" 
          size={100} 
          color={colors.surface} 
        />
        <Text style={[styles.appName, { color: colors.surface }]}>
          Finance Assistant
        </Text>
        <Text style={[styles.loadingText, { color: colors.surface }]}>
          Loading...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 20,
  },
});