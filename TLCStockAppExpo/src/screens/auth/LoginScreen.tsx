import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import ErrorAlert from '../../components/common/ErrorAlert';
import { useTheme } from '../../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNetworkAlert, setShowNetworkAlert] = useState(false);
  const [showLoginErrorAlert, setShowLoginErrorAlert] = useState(false);
  const [loginErrorMessage, setLoginErrorMessage] = useState('');
  

  

  const { login, loginLoading } = useAuth();
  const { colors, themeMode } = useTheme();

  const handleLogin = async () => {
    if (!username || !password) {

      setLoginErrorMessage('Please enter both username and password');
      setShowLoginErrorAlert(true);
      return;
    }
    try {
      const trimmedUsername = username?.trim?.() ?? username;
      const trimmedPassword = password?.trim?.() ?? password;
      await login(trimmedUsername, trimmedPassword);
    } catch (error: any) {
      // Incorrect credentials
      if (error?.code === 'INVALID_CREDENTIALS' || error?.message === 'INVALID_CREDENTIALS') {
        setLoginErrorMessage('Username or Password incorrect');
        setShowLoginErrorAlert(true);
        return;
      }

      if (error?.code === 'API_KEY_INVALID' || error?.message === 'API_KEY_INVALID') {
        setLoginErrorMessage('API key invalid or missing. Please check API configuration.');
        setShowLoginErrorAlert(true);
        return;
      }

      // Check if it's a network error
      if (
        error?.message?.includes('Network Error') ||
        error?.message?.includes('fetch') ||
        error?.message?.includes('timeout') ||
        error?.code === 'NETWORK_ERROR'
      ) {
        setShowNetworkAlert(true);
      } else {
        // Fallback to login error
        setLoginErrorMessage('Login failed. Please try again.');
        setShowLoginErrorAlert(true);
      }
    } finally {
      // Login loading is handled by AuthContext
    }
  };

  const styles = getStyles(colors, themeMode);

  return (
    <View style={styles.container}>
      {/* Themed gradient background */}
      <LinearGradient
        colors={themeMode === 'dark' 
          ? ['#0B1220', '#0F172A', '#111827'] 
          : ['#FFFFFF', '#F8FAFC', '#EEF2FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image 
                source={themeMode === 'dark' 
                  ? require('../../../assets/TLC Logo/DARK_LOGO.png') 
                  : require('../../../assets/TLC Logo/LIGHT_LOGO.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.subtitleText}>
              Sign in to access your pharmacy dashboard
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {/* Username Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeButtonText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>



            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.button, loginLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loginLoading}
            >
              {loginLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={colors.textOnAccent} size="small" />
                  <Text style={styles.buttonText}>Signing in...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Network Error Alert */}
      <ErrorAlert
        visible={showNetworkAlert}
        title="Connection Error"
        message="No internet connection. Please check your network and try again."
        onDismiss={() => setShowNetworkAlert(false)}
      />

      {/* Login Error Alert */}
      <ErrorAlert
        visible={showLoginErrorAlert}
        title="Login Failed"
        message={loginErrorMessage}
        onDismiss={() => setShowLoginErrorAlert(false)}
      />
    </View>
  );
};

const getStyles = (colors: any, themeMode: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: -40,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoImage: {
    height: 72,
    width: 300,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formContainer: {
    marginTop: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfacePrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: themeMode === 'dark' ? 0.3 : 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 40,
    padding: 4,
  },
  eyeButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  button: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled || '#4B5563',
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textOnAccent || '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default LoginScreen;
