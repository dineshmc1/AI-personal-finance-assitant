import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const [currency, setCurrency] = useState('MYR');
    const [currencySymbol, setCurrencySymbol] = useState('RM');
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
            if (storedCurrency && CURRENCY_OPTIONS[storedCurrency]) {
                setCurrency(storedCurrency);
                setCurrencySymbol(CURRENCY_OPTIONS[storedCurrency]);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setIsLoading(false);
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
            updateCurrency,
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
