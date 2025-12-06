// App.js
import 'react-native-gesture-handler';
import React from 'react';
import MainNavigator from "./navigation/MainNavigator";
import { TransactionProvider } from './contexts/TransactionContext';
import { AuthProvider } from './contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
    <TransactionProvider>
      <MainNavigator />
    </TransactionProvider>
    </AuthProvider>
  );
}