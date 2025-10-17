import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { NotificationsProvider } from './src/contexts/NotificationsContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

const AppContent = () => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.surfaceSecondary }]}>
      <View style={styles.mobileContainer}>
        <View style={{ flex: 1, backgroundColor: colors.bgGradientFrom }}>
          <AuthProvider>
            <NotificationsProvider>
              <AppNavigator />
            </NotificationsProvider>
          </AuthProvider>
        </View>
      </View>
    </View>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 430, // Large mobile phone size (iPhone 14 Pro Max width)
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
});

export default App;

