import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Dimensions } from 'react-native';

export interface DateScrollerColors {
  bgGradientFrom: string;
  surfacePrimary: string;
  textPrimary: string;
  textSecondary: string;
  statusError: string;
  accentPrimary: string;
}

interface DateScrollerProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
  colors: DateScrollerColors;
}

const ITEM_WIDTH = 48;
const ITEM_HEIGHT = ITEM_WIDTH;
const ITEM_MARGIN = 5;
const TOTAL_ITEM_WIDTH = ITEM_WIDTH + (ITEM_MARGIN * 2);

const DateScroller: React.FC<DateScrollerProps> = ({ selectedDate, onChange, colors }) => {
  const listRef = useRef<FlatList<Date>>(null);
  const [dateItems, setDateItems] = useState<Date[]>([]);
  const [containerWidth, setContainerWidth] = useState<number>(Dimensions.get('window').width);

  // Update date items whenever selectedDate changes
  useEffect(() => {
    const center = new Date(selectedDate);
    const daysBefore = 7;
    const daysAfter = 7;
    const items: Date[] = [];
    
    // Add 7 days before the selected date
    for (let i = daysBefore; i > 0; i--) {
      const d = new Date(center);
      d.setDate(center.getDate() - i);
      items.push(d);
    }
    
    // Add the selected date in the center
    items.push(new Date(center));
    
    // Add 7 days after the selected date
    for (let i = 1; i <= daysAfter; i++) {
      const d = new Date(center);
      d.setDate(center.getDate() + i);
      items.push(d);
    }
    
    setDateItems(items);
    
    // Calculate the perfect center position
    setTimeout(() => {
      try {
        const centerIndex = daysBefore;
        const containerMargin = 16; // Account for the container marginHorizontal
        const width = containerWidth || Dimensions.get('window').width;
        const centerOffset = (centerIndex * TOTAL_ITEM_WIDTH) - (width / 2) + (TOTAL_ITEM_WIDTH / 2) + containerMargin;
        listRef.current?.scrollToOffset({ offset: centerOffset, animated: true });
      } catch (error) {
        console.log('Scroll error:', error);
      }
    }, 100);
  }, [selectedDate, containerWidth]);

  const renderItem = ({ item }: { item: Date }) => {
    const isSelected = item.toDateString() === selectedDate.toDateString();
    const weekday = item.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
    const dayNum = item.getDate();
    const isWeekend = item.getDay() === 0 || item.getDay() === 6;
    return (
      <TouchableOpacity
        onPress={() => onChange(new Date(item))}
        style={[
          styles.dateChip,
          { backgroundColor: colors.bgGradientFrom },
          isSelected && { backgroundColor: colors.accentPrimary + '22' }
        ]}
        activeOpacity={0.6}
      >
        <Text style={[
          styles.dateChipWeekday,
          { color: isSelected ? colors.accentPrimary : (isWeekend ? colors.statusError : colors.textSecondary) }
        ]}>{weekday}</Text>
        <Text style={[
          styles.dateChipDay,
          { color: isSelected ? colors.accentPrimary : colors.textSecondary }
        ]}>{dayNum}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <FlatList
        ref={listRef}
        data={dateItems}
        keyExtractor={(d: Date) => d.toISOString()}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        getItemLayout={(data, index) => ({ length: TOTAL_ITEM_WIDTH, offset: TOTAL_ITEM_WIDTH * index, index })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
  },
  content: {
    alignItems: 'center',
  },
  dateChip: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: 6,
    marginHorizontal: ITEM_MARGIN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateChipWeekday: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: -4,
  },
  dateChipDay: {
    fontSize: 22,
    fontWeight: '700',
  },
});

export default DateScroller; 