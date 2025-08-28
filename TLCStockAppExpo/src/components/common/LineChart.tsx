import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Animated,
} from 'react-native';
import {
  CartesianChart,
  Line,
  useChartPressState,
} from 'victory-native';
import {
  Circle,
  useFont,
  Text as SkiaText,
  Group,
  RoundedRect,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export interface LineChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

interface LineChartProps {
  data: LineChartDataPoint[];
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  primaryColor?: string;
  strokeWidth?: number;
  showTooltip?: boolean;
  showArea?: boolean;
  animated?: boolean;
  formatYLabel?: (value: number) => string;
  formatXLabel?: (value: string | number) => string;
  onPointPress?: (point: LineChartDataPoint) => void;
}

interface LineChartTheme {
  backgroundColor: string;
  textColor: string;
  gridColor: string;
  tooltipBackground: string;
  tooltipText: string;
}

const getTheme = (theme: 'light' | 'dark'): LineChartTheme => {
  if (theme === 'light') {
    return {
      backgroundColor: '#FFFFFF',
      textColor: '#374151',
      gridColor: '#E5E7EB',
      tooltipBackground: '#1F2937',
      tooltipText: '#F9FAFB',
    };
  }
  return {
    backgroundColor: '#1F2937',
    textColor: '#F9FAFB',
    gridColor: '#374151',
    tooltipBackground: '#374151',
    tooltipText: '#F9FAFB',
  };
};

// Custom Tooltip component using Skia
const ToolTip: React.FC<{
  x: SharedValue<number>;
  y: SharedValue<number>;
  value: SharedValue<number>;
  primaryColor: string;
  theme: LineChartTheme;
}> = ({ x, y, primaryColor, theme }) => {
  return (
    <Group>
      {/* Tooltip circle */}
      <Circle cx={x} cy={y} r={6} color={primaryColor} />
      <Circle cx={x} cy={y} r={4} color={theme.backgroundColor} />
      
      {/* You can add more sophisticated tooltip rendering here */}
      {/* For now, we'll keep it simple with just the circle */}
    </Group>
  );
};

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width: chartWidth = width - 32,
  height = 200,
  theme = 'dark',
  primaryColor = '#FF4500',
  strokeWidth = 2,
  showTooltip = true,
  animated = true,
  formatYLabel,
  formatXLabel,
  onPointPress,
}) => {
  const themeColors = getTheme(theme);
  
  // Early return if no data
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.backgroundColor, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: themeColors.textColor, fontSize: 14 }}>No data available</Text>
      </View>
    );
  }
  
  // Transform data for Victory Native XL format
  const transformedData = data.map((point, index) => ({
    x: index, // Use index for x to ensure numeric values
    y: point.y || 0, // Ensure y is always a number
    originalX: point.x,
    label: point.label,
  }));
  
  console.log('LineChart received data:', data);
  console.log('LineChart transformedData:', transformedData);

  // Initialize chart press state for tooltip
  const { state, isActive } = useChartPressState({ 
    x: 0, 
    y: { y: 0 } 
  });

  // Handle point press
  useEffect(() => {
    if (isActive && onPointPress) {
      // Find the closest data point based on the current press state
      const xIndex = Math.round(state.x.value.value);
      if (xIndex >= 0 && xIndex < data.length) {
        onPointPress(data[xIndex]);
      }
    }
  }, [isActive, state.x.value, onPointPress, data]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      <CartesianChart
        data={transformedData}
        xKey="x"
        yKeys={["y"]}
        chartPressState={showTooltip ? state : undefined}
        xAxis={{
          font: undefined, // You can add font if needed
          lineColor: theme === 'dark' ? '#374151' : '#E5E7EB',
          labelColor: themeColors.textColor,
          tickCount: Math.min(data.length, 6), // Limit tick count for readability
                     formatXLabel: (value: number) => {
             const index = Math.round(value);
             if (index >= 0 && index < data.length) {
               const originalValue = data[index].x;
               return formatXLabel ? formatXLabel(originalValue) : originalValue.toString();
             }
             return value.toString();
           },
        }}
        yAxis={[{
          font: undefined, // You can add font if needed
          lineColor: theme === 'dark' ? '#374151' : '#E5E7EB',
          labelColor: themeColors.textColor,
          formatYLabel: formatYLabel || ((value) => value.toString()),
        }]}
        frame={{
          lineColor: theme === 'dark' ? '#374151' : '#E5E7EB',
          lineWidth: 0, // Hide frame by default
        }}
      >
        {({ points }: { points: any }) => (
          <>
            {/* Main line */}
            <Line 
              points={points.y} 
              color={primaryColor} 
              strokeWidth={strokeWidth}
              animate={animated ? { type: "timing", duration: 1000 } : undefined}
            />
            
            {/* Tooltip */}
            {showTooltip && isActive && (
              <ToolTip
                x={state.x.position}
                y={state.y.y.position}
                value={state.y.y.value}
                primaryColor={primaryColor}
                theme={themeColors}
              />
            )}
          </>
        )}
      </CartesianChart>

      {/* Clear selection info - outside the chart */}
      {showTooltip && isActive && (
        <View style={[styles.tooltipInfo, { backgroundColor: themeColors.tooltipBackground }]}>
          <Text style={[styles.tooltipText, { color: themeColors.tooltipText }]}>
            {(() => {
              const xIndex = Math.round(state.x.value.value);
              if (xIndex >= 0 && xIndex < data.length) {
                const point = data[xIndex];
                return `${formatXLabel ? formatXLabel(point.x) : point.x}: ${formatYLabel ? formatYLabel(point.y) : point.y}`;
              }
              return '';
            })()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 8,
  },
  tooltipInfo: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default LineChart; 