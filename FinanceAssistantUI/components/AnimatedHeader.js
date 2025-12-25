import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, StatusBar } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_MAX_HEIGHT = 70; // Expanded height
const HEADER_MIN_HEIGHT = 50;  // Collapsed height (Hamburger only)
const SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

export default function AnimatedHeader({
    title,
    subtitle,
    scrollY,
    navigation,
    showBack = false,
    rightComponent = null
}) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const totalHeight = HEADER_MAX_HEIGHT + insets.top;

    // 1. Slide Up Logic: Move entire header up and off-screen
    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, totalHeight],
        outputRange: [0, -totalHeight],
        extrapolate: 'clamp',
    });

    // 2. Opacity Logic: Fade out as it slides up
    const headerOpacity = scrollY.interpolate({
        inputRange: [0, totalHeight * 0.5],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View style={[
            styles.container,
            {
                height: totalHeight,
                transform: [{ translateY: headerTranslateY }],
                opacity: headerOpacity,
            }
        ]}>
            {/* Base Glassy Layer */}
            <LinearGradient
                colors={["#00f3ff20", "#8a2be220"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <View style={[styles.content, { paddingTop: insets.top, height: HEADER_MAX_HEIGHT }]}>
                {/* Left Button (Menu or Back) */}
                <TouchableOpacity
                    onPress={() => showBack ? navigation.goBack() : navigation.openDrawer()}
                    style={styles.menuButton}
                >
                    <MaterialCommunityIcons
                        name={showBack ? "arrow-left" : "menu"}
                        size={28}
                        color={colors.primary}
                    />
                </TouchableOpacity>

                {/* Title Container - Fixed (Moves with parent) */}
                <View style={styles.titleContainer}>
                    <Text style={[styles.title, { color: colors.primary, textShadowColor: colors.primary, textShadowRadius: 8 }]}>
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={[styles.subtitle, { color: colors.onSurface }]}>
                            {subtitle}
                        </Text>
                    )}
                </View>

                {/* Right Component */}
                <View style={[styles.rightContainer, { minWidth: 44, alignItems: 'center', justifyContent: 'center' }]}>
                    {rightComponent}
                </View>
            </View>
        </Animated.View>
    );

}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        overflow: 'hidden',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 5,
    },
    menuButton: {
        padding: 8,
        zIndex: 101,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 12,
        opacity: 0.8,
        textAlign: 'center',
    },
    rightContainer: {
        // minWidth handled inline to match menu button
    }
});
