import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LineChart, { LineChartDataPoint } from './LineChart';

// Example component showing how to use the LineChart
export const LineChartExample: React.FC = () => {
  // Sample data - similar to what might come from DailyScreen turnover data
  const sampleData: LineChartDataPoint[] = [
    { x: '1/12', y: 45000, label: 'Dec 1' },
    { x: '2/12', y: 52000, label: 'Dec 2' },
    { x: '3/12', y: 48000, label: 'Dec 3' },
    { x: '4/12', y: 61000, label: 'Dec 4' },
    { x: '5/12', y: 55000, label: 'Dec 5' },
    { x: '6/12', y: 67000, label: 'Dec 6' },
    { x: '7/12', y: 59000, label: 'Dec 7' },
    { x: '8/12', y: 71000, label: 'Dec 8' },
    { x: '9/12', y: 64000, label: 'Dec 9' },
    { x: '10/12', y: 58000, label: 'Dec 10' },
    { x: '11/12', y: 75000, label: 'Dec 11' },
    { x: '12/12', y: 69000, label: 'Dec 12' },
  ];

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
    return `R${value.toFixed(0)}`;
  };

  const handlePointPress = (point: LineChartDataPoint) => {
    console.log('Point pressed:', point);
  };

  return (
    <View style={styles.container}>
      {/* Dark theme example */}
      <View style={styles.chartContainer}>
        <Text style={styles.title}>12-Day Turnover Trend (Dark)</Text>
        <LineChart
          data={sampleData}
          height={220}
          theme="dark"
          primaryColor="#FF4500"
          strokeWidth={2}
          showTooltip={true}
          animated={true}
          formatYLabel={formatCurrency}
          formatXLabel={(value) => value.toString()}
          onPointPress={handlePointPress}
        />
      </View>

      {/* Light theme example */}
      <View style={styles.chartContainer}>
        <Text style={[styles.title, { color: '#374151' }]}>12-Day Turnover Trend (Light)</Text>
        <LineChart
          data={sampleData}
          height={220}
          theme="light"
          primaryColor="#FF4500"
          strokeWidth={2}
          showTooltip={true}
          animated={true}
          formatYLabel={formatCurrency}
          formatXLabel={(value) => value.toString()}
          onPointPress={handlePointPress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#111827',
  },
  chartContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F9FAFB',
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default LineChartExample; 