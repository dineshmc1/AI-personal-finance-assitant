// App.js
import 'react-native-gesture-handler';
import React from 'react';
import MainNavigator from "./navigation/MainNavigator";
import { TransactionProvider } from './contexts/TransactionContext';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';

export default function App() {
  return (
    <AuthProvider>
      <TransactionProvider>
        <SettingsProvider>
          <MainNavigator />
        </SettingsProvider>
      </TransactionProvider>
    </AuthProvider>
  );
}