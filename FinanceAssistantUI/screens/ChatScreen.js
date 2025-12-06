// screens/ChatScreen.js

import React, { useState, useRef, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Alert
} from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { chatService } from "../services/apiClient"; 

export default function ChatScreen({ navigation }) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: "Hello! I'm your AI finance assistant. I can analyze your last 90 days of data, forecast your future balance, or check your financial health. What would you like to do?", 
      isUser: false,
      timestamp: new Date(),
      type: "welcome"
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef(null);
  
  // === 修改部分：对应后端功能的专业问题 ===
  const suggestedQuestions = [
    { label: "📊 90-Day Analysis", query: "Analyze my income and spending over the last 90 days." },
    { label: "🔮 Future Forecast", query: "Forecast my balance and cash flow for the next 30 days." },
    { label: "❤️ Financial Health", query: "What is my current Financial Health Score and risk profile?" },
    { label: "💰 Create Budget", query: "Generate a smart budget based on my recent habits." },
    { label: "👯 Twin Comparison", query: "How am I performing compared to my Digital Twin?" },
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isLoading]);

  const sendMessage = async (textOverride = null) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: textToSend.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      // Call Backend API
      const response = await chatService.sendQuery(textToSend.trim());

      let aiResponseText = "";
      if (response && response.simulation_report) {
        aiResponseText = response.simulation_report;
      } else if (typeof response === 'string') {
        aiResponseText = response;
      } else {
        aiResponseText = JSON.stringify(response, null, 2);
      }

      const aiMessage = {
        id: Date.now() + 1,
        text: aiResponseText,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error("Chat Error:", error);
      
      let errorMessage = "Sorry, I'm having trouble connecting to the server.";
      if (error.status === 400) {
        if (error.message && error.message.includes("Requires at least")) {
           errorMessage = "I need at least 30 days of transaction history to perform this analysis. Please add more transactions.";
        } else {
           errorMessage = error.message;
        }
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      const errorMsgObj = {
        id: Date.now() + 1,
        text: errorMessage,
        isUser: false,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsgObj]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionPress = (question) => {
    sendMessage(question);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const clearChat = () => {
    setMessages([
      { 
        id: Date.now(), 
        text: "Conversation cleared. Pick a suggestion below to start analyzing your data.", 
        isUser: false,
        timestamp: new Date(),
        type: "welcome"
      }
    ]);
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.isUser ? styles.userContainer : styles.aiContainer
    ]}>
      {!item.isUser && (
        <View style={[styles.avatar, { backgroundColor: item.isError ? '#ffebee' : colors.primary + '20' }]}>
          <MaterialCommunityIcons 
            name={item.isError ? "alert-circle" : "robot"} 
            size={16} 
            color={item.isError ? "red" : colors.primary} 
          />
        </View>
      )}
      
      <View style={[
        styles.messageBubble,
        item.isUser 
          ? [styles.userBubble, { backgroundColor: colors.primary }]
          : [styles.aiBubble, { backgroundColor: colors.surface }]
      ]}>
        <Text style={[
          styles.messageText,
          { color: item.isUser ? colors.surface : colors.onSurface }
        ]}>
          {item.text}
        </Text>
        <Text style={[
          styles.timestamp,
          { color: item.isUser ? colors.surface + '80' : colors.onSurface + '60' }
        ]}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );

  // === 修改部分：Footer 组件，包含 Loading 和 建议 Chips ===
  const renderFooter = () => (
    <View style={styles.footerContainer}>
      {isLoading && (
        <View style={[styles.thinkingContainer, { backgroundColor: colors.surface }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.thinkingText, { color: colors.onSurface }]}>
            Analyzing your data...
          </Text>
        </View>
      )}
      
      {/* 始终显示建议问题，除非正在加载 */}
      {!isLoading && (
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionsHeader, { color: colors.onSurface + '80' }]}>
            Suggested Actions:
          </Text>
          <View style={styles.chipsContainer}>
            {suggestedQuestions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.suggestionChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                onPress={() => handleSuggestionPress(item.query)}
              >
                <Text style={[styles.suggestionText, { color: colors.primary }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} 
    >
      <StatusBar backgroundColor={colors.surface} barStyle="dark-content" />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <View style={[styles.aiAvatar, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="robot" size={20} color={colors.surface} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.primary }]}>
              Finance AI
            </Text>
            <Text style={[styles.subtitle, { color: colors.onSurface }]}>
              Data-Driven Insights
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.menuButton} onPress={clearChat}>
          <MaterialCommunityIcons name="autorenew" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages List with Footer */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={renderFooter} // 使用 Footer 显示建议
      />

      {/* Input Section */}
      <View style={[styles.inputSection, { 
        backgroundColor: colors.surface,
        paddingBottom: Platform.OS === 'ios' ? 25 : 20 
      }]}>
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.background, 
              color: colors.onSurface,
              borderColor: colors.outline
            }]}
            placeholder="Ask specific questions..."
            placeholderTextColor={colors.onSurface + '60'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              { 
                backgroundColor: (inputText.trim() && !isLoading) ? colors.primary : colors.surface,
                borderWidth: (inputText.trim() && !isLoading) ? 0 : 1,
                borderColor: colors.outline
              }
            ]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim() || isLoading}
          >
             <MaterialCommunityIcons 
              name="send" 
              size={20} 
              color={(inputText.trim()) ? colors.surface : colors.onSurface + '40'} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 35,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: { padding: 8 },
  headerContent: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  aiAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerText: { alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold' },
  subtitle: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  menuButton: { padding: 8 },
  messagesList: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 20 },
  messageContainer: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 6, maxWidth: '100%' },
  userContainer: { justifyContent: 'flex-end' },
  aiContainer: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  messageBubble: { maxWidth: '80%', padding: 14, borderRadius: 18, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  userBubble: { borderBottomRightRadius: 6 },
  aiBubble: { borderBottomLeftRadius: 6 },
  messageText: { fontSize: 15, lineHeight: 22 },
  timestamp: { fontSize: 10, marginTop: 6, alignSelf: 'flex-end' },
  
  // Footer & Suggestions Styles
  footerContainer: { paddingBottom: 10 },
  thinkingContainer: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, marginTop: 8, marginLeft: 44, alignSelf: 'flex-start', maxWidth: '70%' },
  thinkingText: { fontSize: 12, marginLeft: 8, fontStyle: 'italic' },
  suggestionsContainer: { marginTop: 16, marginLeft: 44 }, // Align with AI bubbles
  suggestionsHeader: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginBottom: 4 },
  suggestionText: { fontSize: 12, fontWeight: '600' },

  inputSection: { padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10, paddingTop: 10, marginRight: 12, maxHeight: 100, fontSize: 16, lineHeight: 20 },
  sendButton: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 2 },
});




