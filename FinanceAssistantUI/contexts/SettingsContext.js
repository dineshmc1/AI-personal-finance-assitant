import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const [currency, setCurrency] = useState('MYR');
    const [currencySymbol, setCurrencySymbol] = useState('RM');
    const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark
    const [isLoading, setIsLoading] = useState(true);

    const CURRENCY_OPTIONS = {
        'MYR': 'RM',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'SGD': 'S$'
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const storedCurrency = await AsyncStorage.getItem('userSettings_currency');
            const storedTheme = await AsyncStorage.getItem('userSettings_theme');

            if (storedCurrency && CURRENCY_OPTIONS[storedCurrency]) {
                setCurrency(storedCurrency);
                setCurrencySymbol(CURRENCY_OPTIONS[storedCurrency]);
            }
            if (storedTheme !== null) {
                setIsDarkMode(storedTheme === 'dark');
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTheme = async () => {
        try {
            const newMode = !isDarkMode;
            setIsDarkMode(newMode);
            await AsyncStorage.setItem('userSettings_theme', newMode ? 'dark' : 'light');
        } catch (error) {
            console.error('Failed to save theme:', error);
        }
    };

    const updateCurrency = async (newCurrency) => {
        try {
            if (CURRENCY_OPTIONS[newCurrency]) {
                setCurrency(newCurrency);
                setCurrencySymbol(CURRENCY_OPTIONS[newCurrency]);
                await AsyncStorage.setItem('userSettings_currency', newCurrency);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to save currency:', error);
            return false;
        }
    };

    return (
        <SettingsContext.Provider value={{
            currency,
            currencySymbol,
            isDarkMode,
            updateCurrency,
            toggleTheme,
            isLoading
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
