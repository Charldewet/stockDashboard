import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthNavigationProp } from '../../types/navigation';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';

// Color scheme matching web app
const colors = {
  bgGradientFrom: '#111827',
  bgGradientTo: '#0F172A',
  surfacePrimary: '#1F2937',
  surfaceSecondary: '#111827',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accentPrimary: '#FF4500',
  border: '#374151',
};

const AccountScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { user, pharmacies } = useAuth();

  const username = user?.username || user?.name || 'Unknown';

  return (
    <View style={styles.container}>
      <View style={styles.stickyHeader}>
        <View style={styles.mainHeaderRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.accentPrimary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Username:</Text>
            <Text style={styles.value}>{username}</Text>
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <Text style={styles.label}>Pharmacies:</Text>
          </View>
          <View style={styles.chips}>
            {(pharmacies || []).map((p: any) => (
              <View key={p.code} style={styles.chip}>
                <Text style={styles.chipText}>{p.name || p.code}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGradientFrom,
  },
  stickyHeader: {
    padding: 16,
    paddingTop: 63,
    backgroundColor: colors.bgGradientFrom,
    zIndex: 1000,
  },
  scrollContent: {
    flex: 1,
  },
  mainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 0,
  },
  backButtonText: {
    fontSize: 20,
    color: colors.accentPrimary,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});

export default AccountScreen; 