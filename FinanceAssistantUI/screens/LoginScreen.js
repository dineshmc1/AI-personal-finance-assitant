// FinanceAssistantUI/screens/LoginScreen.js
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../services/apiClient';

const MODES = {
  LOGIN: 'login',
  REGISTER: 'register',
};

const LoginScreen = () => {
  const { colors } = useTheme();
  const { login, register, authError } = useAuth();
  const [mode, setMode] = useState(MODES.LOGIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const buttonDisabled =
    submitting ||
    !email.trim() ||
    !password.trim() ||
    (mode === MODES.REGISTER && !displayName.trim());

  const handleSubmit = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      if (mode === MODES.LOGIN) {
        await login(email.trim(), password.trim());
      } else {
        await register(email.trim(), password.trim(), displayName.trim());
        setMode(MODES.LOGIN);
      }
    } catch (error) {
      setLocalError(error.message ?? 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#7e92edff', '#84aae7ff']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="finance" size={48} color={colors.primary} />
            <Text style={[styles.title, { color: colors.primary }]}>
              AI Finance Assistant
            </Text>
            <Text style={[styles.subtitle, { color: colors.onSurface }]}>
              {mode === MODES.LOGIN ? 'Welcome back' : 'Create your account'}
            </Text>
          </View>

          <View style={styles.form}>
            {mode === MODES.REGISTER && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.onSurface }]}>Name</Text>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: colors.outline, color: colors.onSurface },
                  ]}
                  placeholder="Your name"
                  placeholderTextColor={colors.onSurface}
                  autoCapitalize="words"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.onSurface }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: colors.outline, color: colors.onSurface },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={colors.onSurface}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.onSurface }]}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: colors.outline, color: colors.onSurface },
                ]}
                placeholder="••••••••"
                placeholderTextColor={colors.onSurface}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {(localError || authError) && (
              <Text style={styles.errorText}>{localError || authError}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: buttonDisabled ? colors.surface : colors.primary,
                borderColor: colors.primary,
                borderWidth: 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={buttonDisabled}
          >
            {submitting ? (
              <ActivityIndicator color={buttonDisabled ? colors.onSurface : '#fff'} />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: buttonDisabled ? colors.onSurface : colors.surface },
                ]}
              >
                {mode === MODES.LOGIN ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() =>
              setMode(mode === MODES.LOGIN ? MODES.REGISTER : MODES.LOGIN)
            }
          >
            <Text style={[styles.toggleText, { color: colors.primary }]}>
              {mode === MODES.LOGIN
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.onSurface }]}>
              Backend: {apiBaseUrl || 'missing EXPO_PUBLIC_API_BASE_URL'}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  form: {
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff20',
  },
  errorText: {
    color: '#F44336',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 13,
  },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.7,
  },
});

export default LoginScreen;

