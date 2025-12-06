// components/SummaryCard.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function SummaryCard({ title, value, trend, icon, type = "default" }) {
  const { colors } = useTheme();
  
  const getTypeColor = () => {
    switch (type) {
      case "income": return "#4CAF50";
      case "expense": return "#F44336";
      case "savings": return "#2196F3";
      default: return colors.primary;
    }
  };

  const getTrendColor = () => {
    if (trend?.startsWith('+')) return "#4CAF50";
    if (trend?.startsWith('-')) return "#F44336";
    return colors.onSurface;
  };

  const getIcon = () => {
    switch (type) {
      case "income": return "trending-up";
      case "expense": return "trending-down";
      case "savings": return "piggy-bank";
      default: return icon || "chart-line";
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: getTypeColor() + '20' }]}>
          <MaterialCommunityIcons 
            name={getIcon()} 
            size={20} 
            color={getTypeColor()} 
          />
        </View>
        {trend && (
          <Text style={[styles.trend, { color: getTrendColor() }]}>
            {trend}
          </Text>
        )}
      </View>
      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      <Text style={[styles.value, { color: getTypeColor() }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    borderRadius: 12, 
    padding: 15, 
    margin: 5, 
    flex: 1,
    elevation: 3 
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  iconContainer: {
    padding: 8,
    borderRadius: 10,
  },
  title: { 
    fontSize: 12, 
    fontWeight: "500",
    marginBottom: 5,
    opacity: 0.8 
  },
  value: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  trend: { 
    fontSize: 10, 
    fontWeight: "600" 
  },
});