import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText, Defs, LinearGradient, Stop, Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

export interface SimpleLineChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

interface SimpleLineChartProps {
  data: SimpleLineChartDataPoint[];
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  primaryColor?: string;
  strokeWidth?: number;
  formatYLabel?: (value: number) => string;
  formatXLabel?: (value: string | number) => string;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  width: propWidth,
  height = 200,
  theme = 'dark',
  primaryColor = '#FF4500',
  strokeWidth = 2,
  formatYLabel,
  formatXLabel,
}) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    data: SimpleLineChartDataPoint;
    pointIndex: number;
  } | null>(null);
  
  // FORCE maximum width to 398px (430px container - 32px padding)
  const chartWidth = Math.min(propWidth ?? width, 398);
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
  const padding = { top: 10, right: 8, bottom: 20, left: 48 };
  const chartArea = {
    width: chartWidth - padding.left - padding.right,
    height: height - padding.top - padding.bottom,
  };

  // Get min and max values
  const yValues = data.map(d => d.y);
  const minY = Math.min(...yValues)*0.5;
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY || 1; // Prevent division by zero

  // Calculate points for the line
  const points = data.map((point, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartArea.width;
    const y = padding.top + chartArea.height - ((point.y - minY) / yRange) * chartArea.height;
    return { x, y, originalPoint: point, index };
  });

  // Create polyline points string
  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Create area path for gradient fill
  const areaPath = points.length > 0 ? 
    `M ${points[0].x} ${points[0].y} ` + 
    points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + 
    ` L ${points[points.length - 1].x} ${height - padding.bottom} ` +
    ` L ${points[0].x} ${height - padding.bottom} Z` : '';

  // Y-axis labels (5 ticks)
  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    const value = minY + (yRange * i) / 4;
    const y = padding.top + chartArea.height - (i / 4) * chartArea.height;
    yTicks.push({ value, y });
  }

  // X-axis labels (show all points)
  const xTicks = data.map((point, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartArea.width;
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
    
    // Find the closest point
    let closestPoint = points[0];
    let minDistance = Math.abs(locationX - points[0].x);
    
    for (let i = 1; i < points.length; i++) {
      const distance = Math.abs(locationX - points[i].x);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = points[i];
      }
    }
    
    // Show tooltip if within reasonable distance (20px)
    if (minDistance <= 20) {
      setTooltip({
        visible: true,
        data: closestPoint.originalPoint,
        pointIndex: closestPoint.index,
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
          <LinearGradient id="areaGradient" x1="0%" y1="10%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.01" />
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

        {/* Gradient area fill */}
        {areaPath && (
          <Path
            d={areaPath}
            fill="url(#areaGradient)"
          />
        )}

        {/* Main line */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={primaryColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Tooltip */}
        {tooltip && (
          <>
            {(() => {
              const pt = points[tooltip.pointIndex];
              const tooltipWidth = 140;
              const tooltipHeight = 44;
              const minX = padding.left;
              const maxX = chartWidth - tooltipWidth - 8;
              const tx = Math.max(minX, Math.min(pt.x - tooltipWidth / 2, maxX));
              const ty = Math.max(8, pt.y - tooltipHeight - 8);
              return (
                <>
                  {/* Bubble */}
                  <Rect x={tx} y={ty} width={tooltipWidth} height={tooltipHeight} rx={6} ry={6} fill={'#111827'} opacity={0.9} />
                  {/* Value */}
                  <SvgText x={tx + 8} y={ty + 18} fontSize="12" fill={'#F9FAFB'} fontWeight="bold">
                    {formatYLabel ? formatYLabel(tooltip.data.y) : tooltip.data.y.toFixed(0)}
                  </SvgText>
                  {/* Label */}
                  <SvgText x={tx + 8} y={ty + 32} fontSize="10" fill={'#D1D5DB'}>
                    {formatXLabel ? formatXLabel(tooltip.data.x) : tooltip.data.x.toString()}
                  </SvgText>
                  {/* Selected point indicator */}
                  <Circle cx={pt.x} cy={pt.y} r={6} fill={'#FFFFFF'} stroke={backgroundColor} strokeWidth={2} />
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

export default SimpleLineChart; 