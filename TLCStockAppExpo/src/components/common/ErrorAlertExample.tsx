import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import ErrorAlert from './ErrorAlert';

// Example component showing how to use ErrorAlert in other screens
const ErrorAlertExample: React.FC = () => {
  const [showError, setShowError] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const showNetworkError = () => {
    setErrorTitle('Connection Error');
    setErrorMessage('No internet connection. Please check your network and try again.');
    setShowError(true);
  };

  const showDataError = () => {
    setErrorTitle('Data Error');
    setErrorMessage('Failed to load data. Please try again later.');
    setShowError(true);
  };

  const showValidationError = () => {
    setErrorTitle('Validation Error');
    setErrorMessage('Please fill in all required fields.');
    setShowError(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={showNetworkError}>
        <Text style={styles.buttonText}>Show Network Error</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={showDataError}>
        <Text style={styles.buttonText}>Show Data Error</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={showValidationError}>
        <Text style={styles.buttonText}>Show Validation Error</Text>
      </TouchableOpacity>

      {/* ErrorAlert Component Usage */}
      <ErrorAlert
        visible={showError}
        title={errorTitle}
        message={errorMessage}
        onDismiss={() => setShowError(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  button: {
    backgroundColor: '#FF4500',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorAlertExample; 