import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText, Defs, LinearGradient, Stop, Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

export interface DoubleLineChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

interface DoubleLineChartProps {
  data1: DoubleLineChartDataPoint[];
  data2: DoubleLineChartDataPoint[];
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  primaryColor?: string;
  secondaryColor?: string;
  strokeWidth?: number;
  formatYLabel?: (value: number) => string;
  formatXLabel?: (value: string | number) => string;
  data1Label?: string;
  data2Label?: string;
}

export const DoubleLineChart: React.FC<DoubleLineChartProps> = ({
  data1,
  data2,
  width: propWidth,
  height = 200,
  theme = 'dark',
  primaryColor = '#FF4500',
  secondaryColor = '#FFD600',
  strokeWidth = 2,
  formatYLabel,
  formatXLabel,
  data1Label = 'Current Year',
  data2Label = 'Previous Year',
}) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    data1: DoubleLineChartDataPoint | null;
    data2: DoubleLineChartDataPoint | null;
    pointIndex: number;
  } | null>(null);
  
  // FORCE maximum width to 398px (430px container - 32px padding)
  const chartWidth = Math.min(propWidth ?? width, 398);

  if (!data1 || data1.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={[styles.emptyText, { color: theme === 'dark' ? '#F9FAFB' : '#374151' }]}>
          No data available
        </Text>
      </View>
    );
  }

  // Calculate chart dimensions
  const padding = { top: 10, right: 8, bottom: 20, left: 48 };
  const chartArea = {
    width: chartWidth - padding.left - padding.right,
    height: height - padding.top - padding.bottom,
  };

  // Get min and max values from both datasets
  const allYValues = [...data1.map(d => d.y), ...data2.map(d => d.y)];
  const minY = Math.min(...allYValues) * 0.5;
  const maxY = Math.max(...allYValues);
  const yRange = maxY - minY || 1; // Prevent division by zero

  // Calculate points for both lines
  const points1 = data1.map((point, index) => {
    const x = padding.left + (index / (data1.length - 1)) * chartArea.width;
    const y = padding.top + chartArea.height - ((point.y - minY) / yRange) * chartArea.height;
    return { x, y, originalPoint: point, index };
  });

  const points2 = data2.map((point, index) => {
    const x = padding.left + (index / (data2.length - 1)) * chartArea.width;
    const y = padding.top + chartArea.height - ((point.y - minY) / yRange) * chartArea.height;
    return { x, y, originalPoint: point, index };
  });

  // Create polyline points strings
  const polylinePoints1 = points1.map(p => `${p.x},${p.y}`).join(' ');
  const polylinePoints2 = points2.map(p => `${p.x},${p.y}`).join(' ');

  // Y-axis labels (5 ticks)
  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    const value = minY + (yRange * i) / 4;
    const y = padding.top + chartArea.height - (i / 4) * chartArea.height;
    yTicks.push({ value, y });
  }

  // X-axis labels (use data1 for x-axis labels)
  const xTicks = data1.map((point, index) => {
    const x = padding.left + (index / (data1.length - 1)) * chartArea.width;
    return { 
      value: formatXLabel ? formatXLabel(point.x) : point.x.toString(), 
      x,
      originalIndex: index 
    };
  });

  const textColor = theme === 'dark' ? '#9CA3AF' : '#6B7280';
  const backgroundColor = theme === 'dark' ? '#1F2937' : '#FFFFFF';

  const handleTouch = (event: any) => {
    const { locationX } = event.nativeEvent;
    
    // Find the closest point from data1
    let closestPoint1 = points1[0];
    let minDistance = Math.abs(locationX - points1[0].x);
    
    for (let i = 1; i < points1.length; i++) {
      const distance = Math.abs(locationX - points1[i].x);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint1 = points1[i];
      }
    }
    
    // Find corresponding point from data2 (same index)
    const correspondingPoint2 = points2[closestPoint1.index] || null;
    
    // Show tooltip if within reasonable distance (20px)
    if (minDistance <= 20) {
      setTooltip({
        visible: true,
        data1: closestPoint1.originalPoint,
        data2: correspondingPoint2?.originalPoint || null,
        pointIndex: closestPoint1.index,
      });
    } else {
      setTooltip(null);
    }
  };

  const handleTouchEnd = () => {
    setTooltip(null);
  };

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: 10, maxWidth: 398 }]}>
      <View style={{ width: chartWidth, height }}>
        <Pressable onPressIn={handleTouch} onPressOut={handleTouchEnd}>
          <View style={{ width: chartWidth, height }}>
            <Svg width={chartWidth} height={height}>
        {/* Gradient definitions */}
        <Defs>
          <LinearGradient id="areaGradient1" x1="0%" y1="10%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.01" />
          </LinearGradient>
          <LinearGradient id="areaGradient2" x1="0%" y1="10%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={secondaryColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={secondaryColor} stopOpacity="0.01" />
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

        {/* Create area path for gradient fill under current year line */}
        {points1.length > 0 && (
          <Path
            d={`M ${points1[0].x} ${points1[0].y} ` + 
               points1.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + 
               ` L ${points1[points1.length - 1].x} ${height - padding.bottom} ` +
               ` L ${points1[0].x} ${height - padding.bottom} Z`}
            fill="url(#areaGradient1)"
          />
        )}

        {/* Main lines */}
        <Polyline
          points={polylinePoints1}
          fill="none"
          stroke={primaryColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        <Polyline
          points={polylinePoints2}
          fill="none"
          stroke={secondaryColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Tooltip */}
        {tooltip && (
          <>
            {(() => {
              const p1 = points1[tooltip.pointIndex];
              const p2 = points2[tooltip.pointIndex];
              const tooltipWidth = 170;
              const tooltipHeight = 54;
              const minX = padding.left;
              const maxX = chartWidth - tooltipWidth - 8;
              const anchorX = p1?.x ?? (p2?.x ?? padding.left);
              const anchorY = Math.min(p1?.y ?? Infinity, p2?.y ?? Infinity);
              const tx = Math.max(minX, Math.min(anchorX - tooltipWidth / 2, maxX));
              const ty = Math.max(8, (anchorY || 0) - tooltipHeight - 8);
              return (
                <>
                  {/* Bubble */}
                  <Rect x={tx} y={ty} width={tooltipWidth} height={tooltipHeight} rx={6} ry={6} fill={'#111827'} opacity={0.9} />
                  {/* Current year */}
                  {tooltip.data1 && (
                    <SvgText x={tx + 8} y={ty + 18} fontSize="12" fill={'#F9FAFB'} fontWeight="bold">
                      {data1Label}: {formatYLabel ? formatYLabel(tooltip.data1.y) : tooltip.data1.y.toFixed(0)}
                    </SvgText>
                  )}
                  {/* Previous year */}
                  {tooltip.data2 && (
                    <SvgText x={tx + 8} y={ty + 34} fontSize="12" fill={'#D1D5DB'}>
                      {data2Label}: {formatYLabel ? formatYLabel(tooltip.data2.y) : tooltip.data2.y.toFixed(0)}
                    </SvgText>
                  )}
                  {/* Selected indicators */}
                  {p1 && <Circle cx={p1.x} cy={p1.y} r={6} fill={'#FFFFFF'} stroke={backgroundColor} strokeWidth={2} />}
                  {p2 && <Circle cx={p2.x} cy={p2.y} r={6} fill={'#FFFFFF'} stroke={backgroundColor} strokeWidth={2} />}
                </>
              );
            })()}
          </>
        )}

            </Svg>
          </View>
        </Pressable>
      </View>
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

export default DoubleLineChart; 