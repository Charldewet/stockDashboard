import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface PlaceholderChartProps {
  height?: number;
  message?: string;
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: colors.surfacePrimary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentPrimary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
    maxWidth: '80%',
    color: colors.textSecondary,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
});

const PlaceholderChart: React.FC<PlaceholderChartProps> = ({ 
  height = 150, 
  message = "Insufficient data for chart" 
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.iconContainer}>
        <BarChart3 size={28} color={colors.accentPrimary} strokeWidth={1.5} />
      </View>
      <Text style={styles.message}>
        {message}
      </Text>
      <View style={styles.dotsContainer}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
};

export default PlaceholderChart; 