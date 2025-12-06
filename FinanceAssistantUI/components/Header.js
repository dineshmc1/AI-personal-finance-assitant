import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function Header({ title, subtitle, balance }) {
  return (
    <LinearGradient colors={["#8E2DE2", "#4A00E0"]} style={styles.header}>
      <View>
        <Text style={styles.title}>{title || "Finance Assistant"}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {balance !== undefined && (
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Total balance</Text>
          <Text style={styles.balanceValue}>RM {balance}</Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#e6e6ff", marginTop: 4 },
  balanceBox: {
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 10,
    borderRadius: 10,
    alignItems: "flex-end",
  },
  balanceLabel: { color: "#fff", fontSize: 12 },
  balanceValue: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
