import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function GlassCard({ children, style, variant = 'dark' }) {
    // Deep space gradient effect
    const bgColors = variant === 'dark'
        ? ['rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.1)'] // Deepening Glass
        : ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']; // Brighter Glass

    return (
        <LinearGradient
            colors={bgColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, style]}
        >
            {children}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',

    },
});
