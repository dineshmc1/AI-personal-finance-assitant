// components/ChatSidebar.js
import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function ChatSidebar({ isVisible, onClose }) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm your AI finance assistant. How can I help you today?", isUser: false },
  ]);
  const [inputText, setInputText] = useState("");

  const sendMessage = () => {
    if (inputText.trim()) {
      setMessages([...messages, 
        { id: Date.now(), text: inputText, isUser: true },
        { id: Date.now() + 1, text: "I'm analyzing your financial data...", isUser: false }
      ]);
      setInputText("");
    }
  };

  if (!isVisible) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.outline }]}>
        <Text style={[styles.title, { color: colors.primary }]}>AI Assistant</Text>
        <TouchableOpacity onPress={onClose}>
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble,
            item.isUser ? styles.userBubble : styles.aiBubble,
            { backgroundColor: item.isUser ? colors.primary : colors.background }
          ]}>
            <Text style={[
              styles.messageText,
              { color: item.isUser ? colors.surface : colors.onSurface }
            ]}>
              {item.text}
            </Text>
          </View>
        )}
        style={styles.messagesList}
      />

      {/* Input */}
      <View style={[styles.inputContainer, { borderTopColor: colors.outline }]}>
        <TextInput
          style={[styles.input, { 
            backgroundColor: colors.background, 
            color: colors.onSurface,
            borderColor: colors.outline
          }]}
          placeholder="Ask about your finances..."
          placeholderTextColor={colors.onSurface}
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity 
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
          onPress={sendMessage}
        >
          <MaterialCommunityIcons name="send" size={20} color={colors.surface} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 300,
    elevation: 10,
    zIndex: 1000,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  messagesList: {
    flex: 1,
    padding: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    marginVertical: 5,
    maxWidth: "80%",
  },
  userBubble: {
    alignSelf: "flex-end",
  },
  aiBubble: {
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 15,
    borderTopWidth: 1,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  sendButton: {
    padding: 10,
    borderRadius: 20,
  },
});