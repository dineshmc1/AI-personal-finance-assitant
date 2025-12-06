import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from "../components/Header";

export default function ReportsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0f10" }}>
      <Header title="Reports" subtitle="Analytics" />
      <View style={{ padding: 16 }}>
        <View style={[styles.card, { backgroundColor: "#111" }]}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Monthly Statistics</Text>
          <Text style={{ color: "#bbb", marginTop: 8 }}>Expenses: 0   Income: 0   Balance: 0</Text>
        </View>

        <View style={[styles.card, { backgroundColor: "#111", marginTop: 12 }]}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Monthly Budget</Text>
          <Text style={{ color: "#bbb", marginTop: 8 }}>Remaining: 0   Budget: 0   Expenses: 0</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, elevation: 3 },
});
