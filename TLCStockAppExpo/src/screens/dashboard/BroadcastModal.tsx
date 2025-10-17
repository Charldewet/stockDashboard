import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const colors = {
  bgGradientFrom: '#111827',
  surfacePrimary: '#1F2937',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accentPrimary: '#FF4500',
  brandPurple: '#6366F1',
  statusSuccess: '#10B981',
  statusError: '#EF4444',
  statusWarning: '#F59E0B',
};

interface BroadcastModalProps {
  route: {
    params: {
      title: string;
      body: string;
      category?: string;
      data?: any;
    };
  };
}

const BroadcastModal: React.FC<BroadcastModalProps> = ({ route }) => {
  const navigation = useNavigation();
  const { title, body } = route.params || { 
    title: 'TLC PharmaSight', 
    body: 'New announcement'
  };

  const close = () => (navigation as any).goBack();

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        
        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.body}>{body}</Text>
        </ScrollView>
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.buttonPrimary} onPress={close}>
            <Text style={styles.buttonPrimaryText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 28,
  },
  contentContainer: {
    maxHeight: 300,
    marginBottom: 20,
  },
  body: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  buttonPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: colors.bgGradientFrom,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BroadcastModal; 