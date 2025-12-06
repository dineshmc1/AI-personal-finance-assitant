// screens/ExportScreen.js
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function ExportScreen() {
  const { colors } = useTheme();
  const [exporting, setExporting] = useState(false);

  const exportOptions = [
    {
      id: 1,
      title: "Export Transactions",
      description: "Download all your transactions as CSV file",
      icon: "file-delimited",
      format: "CSV"
    },
    {
      id: 2,
      title: "Export Reports",
      description: "Generate PDF reports of your financial analytics",
      icon: "chart-box",
      format: "PDF"
    },
    {
      id: 3,
      title: "Backup Data",
      description: "Create a backup of all your financial data",
      icon: "backup-restore",
      format: "JSON"
    },
    {
      id: 4,
      title: "Tax Documents",
      description: "Generate tax-ready documents for filing",
      icon: "file-document",
      format: "PDF"
    }
  ];

  const handleExport = async (option) => {
    setExporting(true);
    
    // Simulate export process
    setTimeout(() => {
      setExporting(false);
      alert(`${option.title} exported successfully!`);
    }, 2000);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.primary }]}>Export & Backup</Text>
      <Text style={[styles.subtitle, { color: colors.onSurface }]}>
        Export your financial data for analysis or backup purposes
      </Text>

      {/* Export Options */}
      <View style={styles.exportSection}>
        {exportOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.exportCard, { backgroundColor: colors.surface }]}
            onPress={() => handleExport(option)}
            disabled={exporting}
          >
            <View style={styles.exportHeader}>
              <MaterialCommunityIcons name={option.icon} size={32} color={colors.primary} />
              <View style={styles.exportInfo}>
                <Text style={[styles.exportTitle, { color: colors.onSurface }]}>{option.title}</Text>
                <Text style={[styles.exportDescription, { color: colors.onSurface }]}>{option.description}</Text>
              </View>
            </View>
            <View style={styles.exportFooter}>
              <Text style={[styles.format, { color: colors.primary }]}>{option.format}</Text>
              <MaterialCommunityIcons name="download" size={20} color={colors.primary} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Export */}
      <View style={[styles.quickExport, { backgroundColor: colors.surface }]}>
        <Text style={[styles.quickExportTitle, { color: colors.onSurface }]}>Quick Export</Text>
        <Text style={[styles.quickExportDesc, { color: colors.onSurface }]}>
          Export all transactions as CSV for spreadsheet analysis
        </Text>
        <TouchableOpacity 
          style={[styles.exportButton, { backgroundColor: colors.primary }]}
          onPress={() => handleExport(exportOptions[0])}
          disabled={exporting}
        >
          <MaterialCommunityIcons name="file-delimited" size={20} color={colors.surface} />
          <Text style={[styles.exportButtonText, { color: colors.surface }]}>
            {exporting ? "Exporting..." : "Export CSV Now"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Export History */}
      <View style={styles.historySection}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent Exports</Text>
        <View style={[styles.historyItem, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="file-delimited" size={24} color={colors.primary} />
          <View style={styles.historyInfo}>
            <Text style={[styles.historyName, { color: colors.onSurface }]}>transactions_jan_2024.csv</Text>
            <Text style={[styles.historyDate, { color: colors.onSurface }]}>Exported 2 days ago</Text>
          </View>
          <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginVertical: 15 },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 30, opacity: 0.8 },
  exportSection: { marginBottom: 30 },
  exportCard: { 
    borderRadius: 12, 
    padding: 20, 
    marginBottom: 15, 
    elevation: 3 
  },
  exportHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 15 
  },
  exportInfo: { 
    flex: 1, 
    marginLeft: 15 
  },
  exportTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginBottom: 5 
  },
  exportDescription: { 
    fontSize: 14, 
    opacity: 0.7 
  },
  exportFooter: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  format: { 
    fontSize: 14, 
    fontWeight: "600" 
  },
  quickExport: { 
    borderRadius: 12, 
    padding: 20, 
    marginBottom: 30, 
    elevation: 3 
  },
  quickExportTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginBottom: 8 
  },
  quickExportDesc: { 
    fontSize: 14, 
    marginBottom: 15, 
    opacity: 0.7 
  },
  exportButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    padding: 15, 
    borderRadius: 8 
  },
  exportButtonText: { 
    fontSize: 16, 
    fontWeight: "600", 
    marginLeft: 8 
  },
  historySection: { marginBottom: 20 },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginBottom: 15 
  },
  historyItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: 15, 
    borderRadius: 8 
  },
  historyInfo: { 
    flex: 1, 
    marginLeft: 15 
  },
  historyName: { 
    fontSize: 16, 
    fontWeight: "500" 
  },
  historyDate: { 
    fontSize: 12, 
    opacity: 0.7, 
    marginTop: 2 
  },
});