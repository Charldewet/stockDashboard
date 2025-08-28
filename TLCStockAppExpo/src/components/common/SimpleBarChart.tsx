import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Svg, { Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

export interface SimpleBarChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

interface SimpleBarChartProps {
  data: SimpleBarChartDataPoint[];
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  primaryColor?: string;
  barWidth?: number;
  barSpacing?: number;
  formatYLabel?: (value: number) => string;
  formatXLabel?: (value: string | number) => string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  width: chartWidth = width,
  height = 200,
  theme = 'dark',
  primaryColor = '#FF4500',
  barWidth = 20,
  barSpacing = 8,
  formatYLabel,
  formatXLabel,
}) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    data: SimpleBarChartDataPoint;
    pointIndex: number;
  } | null>(null);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={[styles.emptyText, { color: theme === 'dark' ? '#F9FAFB' : '#374151' }]}>
          No data available
        </Text>
      </View>
    );
  }

  // Calculate chart dimensions
  const padding = { top: 8, right: 8, bottom: 20, left: 48 };
  const chartArea = {
    width: chartWidth - padding.left - padding.right,
    height: height - padding.top - padding.bottom,
  };

  // Get min and max values
  const yValues = data.map(d => d.y);
  const minY = 0; // Bar charts typically start from 0
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY || 1; // Prevent division by zero

  // Calculate bar positions and dimensions
  const totalBarWidth = barWidth + barSpacing;
  const bars = data.map((point, index) => {
    const x = padding.left + (index * totalBarWidth) + (barSpacing / 1.5);
    const barHeight = ((point.y - minY) / yRange) * chartArea.height;
    const y = padding.top + chartArea.height - barHeight;
    
    return { 
      x, 
      y, 
      width: barWidth, 
      height: barHeight, 
      originalPoint: point, 
      index,
      centerX: x + (barWidth / 2)
    };
  });

  // Y-axis labels (5 ticks)
  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    const value = minY + (yRange * i) / 4;
    const y = padding.top + chartArea.height - (i / 4) * chartArea.height;
    yTicks.push({ value, y });
  }

  // X-axis labels
  const xTicks = bars.map((bar) => {
    return { 
      value: formatXLabel ? formatXLabel(bar.originalPoint.x) : bar.originalPoint.x.toString(), 
      x: bar.centerX,
      originalIndex: bar.index 
    };
  });

  const textColor = theme === 'dark' ? '#9CA3AF' : '#6B7280';
  const backgroundColor = theme === 'dark' ? '#1F2937' : '#FFFFFF';

  const handleTouch = (event: any) => {
    const { locationX } = event.nativeEvent;
    
    // Find the closest bar
    let closestBar = bars[0];
    let minDistance = Math.abs(locationX - bars[0].centerX);
    
    for (let i = 1; i < bars.length; i++) {
      const distance = Math.abs(locationX - bars[i].centerX);
      if (distance < minDistance) {
        minDistance = distance;
        closestBar = bars[i];
      }
    }
    
    // Show tooltip if within reasonable distance (bar width + spacing)
    if (minDistance <= (barWidth + barSpacing) / 2) {
      setTooltip({
        visible: true,
        data: closestBar.originalPoint,
        pointIndex: closestBar.index,
      });
    } else {
      setTooltip(null);
    }
  };

  const handleTouchEnd = () => {
    setTooltip(null);
  };

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: 10, width: chartWidth * 1.09, height: height * 1.15 }]}>
      <TouchableWithoutFeedback onPress={handleTouch} onPressOut={handleTouchEnd}>
        <Svg width={chartWidth} height={height}>
        {/* Gradient definitions */}
        <Defs>
          <LinearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.4" />
          </LinearGradient>
        </Defs>

        {/* Y-axis labels */}
        {yTicks.map((tick, index) => (
          <SvgText
            key={index}
            x={padding.left - 10}
            y={tick.y}
            fontSize="8"
            fill={textColor}
            textAnchor="end"
            alignmentBaseline="middle"
          >
            {formatYLabel ? formatYLabel(tick.value) : tick.value.toFixed(0)}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick, index) => (
          <SvgText
            key={index}
            x={tick.x}
            y={height - 5}
            fontSize="8"
            fill={textColor}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {tick.value}
          </SvgText>
        ))}

        {/* Bars */}
        {bars.map((bar, index) => (
          <Rect
            key={index}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill={primaryColor}
            rx={2}
            ry={2}
          />
        ))}

        {/* Tooltip */}
        {tooltip && (
          <>
            {/* Value */}
            <SvgText
              x={padding.left + 10}
              y={height - 45}
              fontSize="16"
              fill={'#FFFFFF'}
              textAnchor="start"
              alignmentBaseline="middle"
              fontWeight="bold"
            >
              {formatYLabel ? formatYLabel(tooltip.data.y) : tooltip.data.y.toFixed(3)}
            </SvgText>
            
            {/* Date label */}
            <SvgText
              x={padding.left + 10}
              y={height - 30}
              fontSize="10"
              fill={'#FFFFFF'}
              textAnchor="start"
              alignmentBaseline="middle"
            >
              {formatXLabel ? formatXLabel(tooltip.data.x) : tooltip.data.x.toString()}
            </SvgText>
            
            {/* Selected bar indicator */}
            <Rect
              x={bars[tooltip.pointIndex].x - 2}
              y={bars[tooltip.pointIndex].y - 2}
              width={bars[tooltip.pointIndex].width + 4}
              height={bars[tooltip.pointIndex].height + 4}
              fill="none"
              stroke={'#FFFFFF'}
              strokeWidth={2}
              rx={4}
              ry={4}
            />
          </>
        )}

      </Svg>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 8,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
  },
  emptyText: {
    fontSize: 14,
  },
});

export default SimpleBarChart; 