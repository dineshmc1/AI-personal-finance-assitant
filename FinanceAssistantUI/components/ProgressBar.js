// components/ProgressBar.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

export default function ProgressBar({ 
  progress, 
  showPercentage = false,
  color, // Accept custom color prop
  variant = "primary" // primary, success, warning, danger
}) {
  const { colors } = useTheme();
  
  const percentage = Math.round(progress * 100);
  
  const getProgressColor = () => {
    // Use custom color if provided, otherwise use variant system
    if (color) return color;
    
    switch (variant) {
      case "success": return "#4CAF50"; // Green
      case "warning": return "#FF9800"; // Orange
      case "danger": return "#F44336"; // Red
      default: return colors.primary; // Blue
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.outer, { backgroundColor: colors.outlineVariant || "#ddd" }]}>
        <View style={[
          styles.inner, 
          { 
            width: `${percentage}%`, 
            backgroundColor: getProgressColor(),
          }
        ]} />
      </View>
      {showPercentage && (
        <Text style={[
          styles.percentageText, 
          { color: colors.onSurface }
        ]}>
          {percentage}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  outer: { 
    flex: 1,
    height: 10, 
    borderRadius: 10, 
    overflow: "hidden" 
  },
  inner: { 
    height: "100%",
    borderRadius: 10,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 35,
  },
});