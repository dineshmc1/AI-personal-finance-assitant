// contexts/AuthContext.js
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  // 关键：从 firebase/auth 导入持久化工具
  getReactNativePersistence, 
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import firebaseConfig, { validateFirebaseConfig } from '../config/firebaseConfig';
import {
  clearAuthToken,
  setAuthToken,
  setTokenRefreshHandler,
} from '../services/apiClient';

const AuthContext = createContext(null);
const AUTH_TOKEN_KEY = 'finance-assistant:idToken';

let firebaseApp;
let authInstance;

// === 1. 初始化 Firebase App 和 Auth ===
try {
  validateFirebaseConfig();
  
  // 防止热重载时重复初始化
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
    // 首次初始化：配置持久化
    authInstance = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } else {
    firebaseApp = getApp();
    // 已经初始化过：直接获取实例
    authInstance = getAuth(firebaseApp);
  }
} catch (error) {
  console.warn('[Auth] Firebase config/init error:', error.message);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  // 默认 true，等待 Firebase 首次回调
  const [initializing, setInitializing] = useState(true); 
  const [authError, setAuthError] = useState(null);

  // === 2. 监听 Auth 状态变化 ===
  useEffect(() => {
    if (!authInstance) {
      setAuthError('Firebase is not configured. Check keys.');
      setInitializing(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(authInstance, async (currentUser) => {
      if (currentUser) {
        try {
          // 强制获取最新 Token
          const token = await currentUser.getIdToken();
          setUser(currentUser);
          setIdToken(token);
          setAuthToken(token); // 设置给 API Client
          await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
        } catch (err) {
          console.error('[Auth] Failed to fetch ID token:', err);
          setAuthError(err.message);
        }
      } else {
        // 用户登出
        setUser(null);
        setIdToken(null);
        clearAuthToken();
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      }
      
      // 无论登录还是登出，第一次回调后，初始化结束
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // === 3. 核心功能函数 ===

  const login = useCallback(async (email, password) => {
    if (!authInstance) throw new Error('Auth not ready');
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(authInstance, email, password);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    if (!authInstance) throw new Error('Auth not ready');
    setAuthError(null);
    try {
      const credential = await createUserWithEmailAndPassword(authInstance, email, password);
      if (displayName) {
        await updateProfile(credential.user, { displayName });
      }
      return credential;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    if (!authInstance) return;
    try {
      await signOut(authInstance);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    if (!authInstance?.currentUser) return null;
    try {
      const token = await authInstance.currentUser.getIdToken(true); // 强制刷新
      setIdToken(token);
      setAuthToken(token);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      return token;
    } catch (error) {
      console.warn('[Auth] Token refresh failed:', error);
      throw error;
    }
  }, []);

  // 设置自动刷新 Token 的 Handler
  useEffect(() => {
    setTokenRefreshHandler(async () => {
      try {
        return await refreshToken();
      } catch (error) {
        console.warn('[Auth] Auto refresh failed, logging out.');
        await logout();
        throw error;
      }
    });
  }, [refreshToken, logout]);

  const value = useMemo(() => ({
    user,
    idToken,
    initializing,
    isAuthenticated: !!user,
    authError,
    login,
    register,
    logout,
    refreshToken
  }), [user, idToken, initializing, authError, login, register, logout, refreshToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};