// screens/UploadScreen.js
import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Modal, 
  TextInput, 
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useTransactions } from "../contexts/TransactionContext";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function UploadScreen() {
  const { colors } = useTheme();
  const { 
    addTransaction, 
    uploadReceipt, 
    categories, 
    getCategoryIcon 
  } = useTransactions();
  
  const navigation = useNavigation();
  
  const [documents, setDocuments] = useState([]);
  const [images, setImages] = useState([]);
  
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [progressAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [manualEntry, setManualEntry] = useState({
    type: 'expend',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5)
  });

  const displayCategories = categories.filter(c => 
      (manualEntry.type === 'expend' && c.type === 'Expense') ||
      (manualEntry.type === 'income' && c.type === 'Income')
  );

  const fallbackCategories = manualEntry.type === 'expend' 
      ? ['Food', 'Transport', 'Shopping', 'Bills'] 
      : ['Salary', 'Freelance'];

  const finalCategoriesList = displayCategories.length > 0 
      ? displayCategories.map(c => c.name) 
      : fallbackCategories;


  const startProgressAnimation = () => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 0.9, 
      duration: 3000,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  const finishProgressAnimation = () => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  };

  const startSuccessAnimation = () => {
    setShowSuccessAnimation(true);
    scaleAnim.setValue(1);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 300, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  // ... pickDocument, takePhoto, pickImageFromGallery, handleFileUpload ...
  const handleFileUpload = async (uri, type, name, mimeType) => {
    setIsSaving(true);
    startProgressAnimation();
    try {
      const extractedCount = await uploadReceipt(uri, mimeType);
      finishProgressAnimation();
      if (extractedCount > 0) {
        startSuccessAnimation();
        if (type === 'document') setDocuments(prev => [...prev, { name, date: new Date().toLocaleDateString(), id: Date.now(), type }]);
        else setImages(prev => [...prev, { uri, name, date: new Date().toLocaleDateString(), id: Date.now(), type, width: 0, height: 0 }]);
        setTimeout(() => {
          Alert.alert("Success", `AI successfully extracted ${extractedCount} transaction(s)!`, [{ text: "OK", onPress: () => navigation.navigate('MainRoot') }]);
          setIsSaving(false);
          setShowSuccessAnimation(false);
        }, 1500);
      } else {
        setIsSaving(false);
        Alert.alert("Info", "Upload complete, but no transactions were detected by AI.");
      }
    } catch (error) {
      setIsSaving(false);
      Alert.alert("Upload Failed", error.message || "Could not analyze the file.");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (!result.canceled) {
        const file = result.assets[0];
        await handleFileUpload(file.uri, 'document', file.name, file.mimeType || 'application/pdf');
      }
    } catch (error) { Alert.alert("Error", "Failed to upload document"); }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { alert('Need camera permission'); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) {
        const file = result.assets[0];
        await handleFileUpload(file.uri, 'photo', `camera_${Date.now()}.jpg`, 'image/jpeg');
      }
    } catch (error) { Alert.alert("Error", "Failed to take photo"); }
  };

  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { alert('Need gallery permission'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (!result.canceled) {
        const file = result.assets[0];
        await handleFileUpload(file.uri, 'gallery', file.fileName || `gallery_${Date.now()}.jpg`, 'image/jpeg');
      }
    } catch (error) { Alert.alert("Error", "Failed to select image"); }
  };

  const viewImage = (image) => { setSelectedImage(image); setShowImageModal(true); };
  
  const downloadImage = async () => { /* ... (no change) ... */ };
  const showAlternativeOptions = () => { /* ... (no change) ... */ };
  const deleteImage = (imageId, imageName) => { /* ... (no change) ... */ };

  const handleManualEntry = async () => {
    if (!manualEntry.amount || !manualEntry.category || !manualEntry.description) {
      alert('Please fill all required fields');
      return;
    }

    setIsSaving(true);
    startProgressAnimation();

    try {
      const newTransaction = {
        type: manualEntry.type, // 'income' or 'expend'
        category: manualEntry.category,
        amount: parseFloat(manualEntry.amount),
        date: new Date(manualEntry.date),
        time: manualEntry.time,
        description: manualEntry.description,
        icon: getCategoryIcon(manualEntry.category) 
      };

      await new Promise(resolve => setTimeout(resolve, 1000)); 
      
      await addTransaction(newTransaction);
      
      finishProgressAnimation();
      startSuccessAnimation();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShowManualEntry(false);
      setManualEntry({
        type: 'expend',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5)
      });
      
      navigation.navigate('MainRoot'); 
      
    } catch (error) {
      alert('Failed to save transaction');
      console.error('Save transaction error:', error);
    } finally {
      setIsSaving(false);
      setShowSuccessAnimation(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["#7e92edff", "#84aae7ff"]} style={styles.headerGradient}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Upload & Track</Text>
            <Text style={styles.subtitle}>Upload receipts via AI or add manually</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.uploadSection}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Quick Actions</Text>
          <View style={styles.uploadButtons}>
            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: colors.surface }]} onPress={pickDocument}>
              <MaterialCommunityIcons name="file-document" size={32} color={colors.primary} />
              <Text style={[styles.uploadText, { color: colors.onSurface }]}>Upload Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: colors.surface }]} onPress={takePhoto}>
              <MaterialCommunityIcons name="camera" size={32} color={colors.primary} />
              <Text style={[styles.uploadText, { color: colors.onSurface }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: colors.surface }]} onPress={pickImageFromGallery}>
              <MaterialCommunityIcons name="image" size={32} color={colors.primary} />
              <Text style={[styles.uploadText, { color: colors.onSurface }]}>From Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: colors.surface }]} onPress={() => setShowManualEntry(true)}>
              <MaterialCommunityIcons name="plus-circle" size={32} color={colors.primary} />
              <Text style={[styles.uploadText, { color: colors.onSurface }]}>Manual Entry</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Uploads List (Optional, keeps previous logic) */}
        <View style={styles.recentSection}>
        </View>
      </ScrollView>

      {/* Image View Modal */}
      {/* ... */}

      {/* Manual Entry Modal - UPDATED */}
      <Modal visible={showManualEntry} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <LinearGradient colors={["#7e92edff", "#84aae7ff"]} style={styles.modalHeaderGradient}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => !isSaving && setShowManualEntry(false)}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Manual Entry</Text>
              <View style={styles.placeholder} />
            </View>
          </LinearGradient>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Loading Overlay */}
            {isSaving && (
              <View style={styles.loadingOverlay}>
                 <ActivityIndicator size="large" color={colors.primary} />
                 <Text style={{marginTop: 10, color: 'white'}}>Saving...</Text>
              </View>
            )}

            {/* Type Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Transaction Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, { backgroundColor: manualEntry.type === 'income' ? colors.primary : colors.surface, borderColor: colors.primary }]}
                  onPress={() => setManualEntry({...manualEntry, type: 'income', category: ''})} // Reset category on switch
                  disabled={isSaving}
                >
                  <Text style={[styles.typeText, { color: manualEntry.type === 'income' ? colors.surface : colors.primary }]}>Income</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, { backgroundColor: manualEntry.type === 'expend' ? colors.primary : colors.surface, borderColor: colors.primary }]}
                  onPress={() => setManualEntry({...manualEntry, type: 'expend', category: ''})}
                  disabled={isSaving}
                >
                  <Text style={[styles.typeText, { color: manualEntry.type === 'expend' ? colors.surface : colors.primary }]}>Expend</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Amount */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Amount (RM)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]}
                placeholder="0.00"
                placeholderTextColor={colors.onSurface}
                keyboardType="decimal-pad"
                value={manualEntry.amount}
                onChangeText={(text) => setManualEntry({...manualEntry, amount: text})}
                editable={!isSaving}
              />
            </View>

            {/* === Grid === */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {finalCategoriesList.map((catName) => (
                  <TouchableOpacity
                    key={catName}
                    style={[
                      styles.categoryButton,
                      { 
                        backgroundColor: manualEntry.category === catName ? colors.primary : colors.surface,
                        borderColor: colors.primary
                      }
                    ]}
                    onPress={() => setManualEntry({...manualEntry, category: catName})}
                    disabled={isSaving}
                  >
                    <MaterialCommunityIcons 
                      name={getCategoryIcon(catName)} 
                      size={16} 
                      color={manualEntry.category === catName ? colors.surface : colors.primary} 
                    />
                    <Text style={[
                      styles.categoryText,
                      { color: manualEntry.category === catName ? colors.surface : colors.primary }
                    ]}>
                      {catName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]}
                placeholder="Enter description..."
                placeholderTextColor={colors.onSurface}
                multiline
                numberOfLines={3}
                value={manualEntry.description}
                onChangeText={(text) => setManualEntry({...manualEntry, description: text})}
                editable={!isSaving}
              />
            </View>

            {/* Date & Time */}
            <View style={styles.section}>
               <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={[styles.label, { color: colors.onSurface }]}>Date</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]} value={manualEntry.date} onChangeText={(text) => setManualEntry({...manualEntry, date: text})} placeholder="YYYY-MM-DD" editable={!isSaving} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.label, { color: colors.onSurface }]}>Time</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outline }]} value={manualEntry.time} onChangeText={(text) => setManualEntry({...manualEntry, time: text})} placeholder="HH:MM" editable={!isSaving} />
                </View>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: isSaving ? '#CCCCCC' : colors.primary }]}
              onPress={handleManualEntry}
              disabled={isSaving}
            >
               <Text style={[styles.saveButtonText, { color: colors.surface }]}>
                {isSaving ? 'Saving...' : 'Save Transaction'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingTop: 20, paddingBottom: 50, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  headerTextContainer: { flex: 1, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, opacity: 0.8, marginTop: 2, color: '#fff' },
  scrollView: { flex: 1, marginTop: -20 },
  scrollContent: { paddingBottom: 20 },
  uploadSection: { marginVertical: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  uploadButtons: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  uploadButton: { alignItems: "center", padding: 20, borderRadius: 12, width: "48%", marginBottom: 10, elevation: 3 },
  uploadText: { fontSize: 14, fontWeight: "600", marginTop: 10, textAlign: "center" },
  recentSection: { marginTop: 20, paddingHorizontal: 16 },
  item: { flexDirection: "row", alignItems: "center", padding: 15, borderRadius: 12, marginVertical: 5, elevation: 2 },
  itemInfo: { flex: 1, marginLeft: 15 },
  itemName: { fontSize: 16, fontWeight: "500" },
  itemDate: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  tapHint: { fontSize: 10, marginTop: 4, fontStyle: 'italic' },
  thumbnail: { width: 60, height: 60, borderRadius: 8 },
  itemActions: { flexDirection: 'row', alignItems: 'center' },
  downloadButton: { padding: 8, borderRadius: 6, backgroundColor: 'rgba(76, 175, 80, 0.1)', marginLeft: 8 },
  emptyContainer: { alignItems: "center", padding: 40 },
  emptyText: { textAlign: "center", fontStyle: "italic", fontSize: 16, marginTop: 12 },
  
  // Modal Styles
  modalContainer: { flex: 1 },
  modalHeaderGradient: { paddingTop: 5, paddingBottom: 5 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 20 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: '#fff' },
  placeholder: { width: 24 },
  form: { flex: 1, padding: 16 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  loadingContainer: { padding: 30, borderRadius: 16, alignItems: 'center', minWidth: 200, elevation: 8 },
  loadingText: { fontSize: 16, fontWeight: 'bold', marginTop: 16, textAlign: 'center' },
  progressContainer: { marginTop: 20, width: '100%', alignItems: 'center' },
  progressBar: { height: 6, width: '100%', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, textAlign: 'center' },
  section: { marginBottom: 24 },
  typeSelector: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E0E0' },
  typeButton: { flex: 1, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1 },
  typeText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  categoryButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, margin: 4, borderRadius: 20, borderWidth: 1 },
  categoryText: { fontSize: 12, fontWeight: '500', marginLeft: 4 },
  row: { flexDirection: 'row' },
  inputGroup: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  saveButton: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 30 },
  saveButtonText: { fontSize: 16, fontWeight: 'bold' },
  bottomPadding: { height: 20 },
});