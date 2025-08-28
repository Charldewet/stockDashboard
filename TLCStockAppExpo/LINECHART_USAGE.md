# LineChart Component Usage Guide

## Overview

The `LineChart` component is a reusable, feature-rich charting component built with Victory Native XL and React Native Skia. It provides animated line charts with touch interactions, tooltip support, and theme switching capabilities.

## Features

- ✅ **Animated line drawing** on load and data updates
- ✅ **Touch interactions** with tooltip/marker on tap/drag
- ✅ **Light/dark theme support**
- ✅ **Custom axes** with dynamic scaling, no grid lines by default
- ✅ **TypeScript support** with full type safety
- ✅ **Functional components** using React hooks
- ✅ **Primary accent color** line with configurable stroke width
- ✅ **Expo managed workflow** compatibility

## Installation

The following dependencies are already installed:
- `victory-native` (^41.18.0)
- `@shopify/react-native-skia` (^2.1.1)
- `react-native-reanimated` (^3.19.0)
- `react-native-gesture-handler` (^2.27.2)

## Basic Usage

```tsx
import React from 'react';
import { View } from 'react-native';
import LineChart, { LineChartDataPoint } from './components/common/LineChart';

const MyComponent = () => {
  const data: LineChartDataPoint[] = [
    { x: '1/12', y: 45000, label: 'Dec 1' },
    { x: '2/12', y: 52000, label: 'Dec 2' },
    { x: '3/12', y: 48000, label: 'Dec 3' },
    // ... more data points
  ];

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
    return `R${value.toFixed(0)}`;
  };

  return (
    <View style={{ height: 300 }}>
      <LineChart
        data={data}
        height={250}
        theme="dark"
        primaryColor="#FF4500"
        strokeWidth={2}
        showTooltip={true}
        animated={true}
        formatYLabel={formatCurrency}
        formatXLabel={(value) => value.toString()}
        onPointPress={(point) => console.log('Pressed:', point)}
      />
    </View>
  );
};
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `LineChartDataPoint[]` | **Required** | Array of data points to plot |
| `width` | `number` | `width - 32` | Chart width |
| `height` | `number` | `200` | Chart height |
| `theme` | `'light' \| 'dark'` | `'dark'` | Theme for colors |
| `primaryColor` | `string` | `'#FF4500'` | Line color (accent color) |
| `strokeWidth` | `number` | `2` | Line stroke width |
| `showTooltip` | `boolean` | `true` | Enable touch tooltips |
| `animated` | `boolean` | `true` | Enable animations |
| `formatYLabel` | `(value: number) => string` | `undefined` | Y-axis label formatter |
| `formatXLabel` | `(value: string \| number) => string` | `undefined` | X-axis label formatter |
| `onPointPress` | `(point: LineChartDataPoint) => void` | `undefined` | Point press handler |

## Data Format

```tsx
interface LineChartDataPoint {
  x: string | number;  // X-axis value (will be converted to index internally)
  y: number;           // Y-axis value (must be numeric)
  label?: string;      // Optional label for tooltips
}
```

## Theme Support

The component supports both light and dark themes:

```tsx
// Dark theme (default)
<LineChart data={data} theme="dark" />

// Light theme
<LineChart data={data} theme="light" />
```

## DailyScreen Integration

The component has been integrated into `DailyScreen.tsx` to replace the old `react-native-gifted-charts` BarChart:

```tsx
<LineChart
  data={dailyTurnoverData.map((item: any) => ({
    x: item.label,
    y: item.value,
    label: item.label,
  }))}
  width={width - 64}
  height={200}
  theme="dark"
  primaryColor={colors.accentPrimary}
  strokeWidth={2}
  showTooltip={true}
  animated={true}
  formatYLabel={(value: number) => {
    if (value >= 1000000) return `R${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
    return `R${value.toFixed(0)}`;
  }}
  formatXLabel={(value: string | number) => value.toString()}
/>
```

## Removed Dependencies

The following old chart libraries have been removed from `package.json`:
- ❌ `react-native-chart-kit`
- ❌ `react-native-gifted-charts`

## Example Files

- `src/components/common/LineChart.tsx` - Main component
- `src/components/common/LineChartExample.tsx` - Usage examples
- `src/screens/dashboard/DailyScreen.tsx` - Real-world integration

## Touch Interactions

The chart supports touch interactions:
- **Tap** on data points to show tooltip
- **Drag** along the line to see different values
- **Tooltip** displays formatted X and Y values
- **Visual indicator** shows selected point with colored circle

## Performance Notes

- Uses Victory Native XL for optimal performance
- Skia-based rendering for smooth animations
- Reanimated for performant gesture handling
- Automatic data transformation for optimal rendering

## Troubleshooting

If you encounter peer dependency issues, install with:
```bash
npm install --legacy-peer-deps
```

The component is fully compatible with Expo managed workflow and doesn't require ejecting. 