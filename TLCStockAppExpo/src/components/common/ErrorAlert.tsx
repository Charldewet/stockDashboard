import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';

interface ErrorAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({
  visible,
  title,
  message,
  onDismiss,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.alertContainer}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertTitle}>{title}</Text>
          </View>
          <View style={styles.alertBody}>
            <Text style={styles.alertMessage}>{message}</Text>
          </View>
          <View style={styles.alertFooter}>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={onDismiss}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alertHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F9FAFB',
    textAlign: 'center',
  },
  alertBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  alertMessage: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  alertFooter: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  alertButton: {
    backgroundColor: '#FF4500',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  alertButtonText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorAlert; 