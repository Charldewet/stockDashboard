import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

// Color scheme matching web app
const colors = {
  // Background gradients
  bgGradientFrom: '#111827',
  bgGradientTo: '#0F172A',
  
  // Surface colors
  surfacePrimary: '#1F2937',
  surfaceSecondary: '#111827',
  
  // Text colors
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  
  // Accent colors
  accentPrimary: '#FF4500',
  accentPrimaryHover: '#E63E00',
  accentPrimaryFocus: '#FFA500',
  
  // Status colors
  statusSuccess: '#10B981',
  statusWarning: '#F59E0B',
  statusError: '#EF4444',
  
  // Chart colors
  chartGold: '#FFD600',
  chartCoquelicot: '#FF4509',
  costSales: '#A0FC4E',
  
  // Border colors
  border: '#374151',
};

export interface DataStatus {
  date: string; // Format: 'YYYY-MM-DD'
  status: 'complete' | 'partial' | 'none';
}

interface DataCalendarProps {
  currentDate: Date;
  dataStatus: DataStatus[];
  onDatePress?: (date: Date) => void;
}

const DataCalendar: React.FC<DataCalendarProps> = ({
  currentDate,
  dataStatus,
  onDatePress,
}) => {
  const getFirstDayOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
  const getLastDayOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const getFirstDayOfWeek = (date: Date): number => getFirstDayOfMonth(date).getDay();
  const getDaysInMonth = (date: Date): number => getLastDayOfMonth(date).getDate();

  const getDataStatusForDate = (date: Date): 'complete' | 'partial' | 'none' => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateString = `${y}-${m}-${d}`;
    const statusItem = dataStatus.find(item => item.date === dateString);
    return statusItem ? statusItem.status : 'none';
  };

  const getStatusColor = (status: 'complete' | 'partial' | 'none'): string => {
    switch (status) {
      case 'complete':
        return colors.costSales; // App green from cost of sales
      case 'partial':
        return colors.accentPrimary; // App accent orange
      case 'none':
      default:
        return colors.surfacePrimary;
    }
  };

  const generateCalendarWeeks = (): (Date | null)[][] => {
    const weeks: (Date | null)[][] = [];
    const firstDayOfWeek = getFirstDayOfWeek(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);

    let currentWeek: (Date | null)[] = [];
    
    // Add empty cells for days before the 1st of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
      
      // If we've filled a week (7 days), start a new week
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Add the last partial week if it exists
    if (currentWeek.length > 0) {
      // Fill the rest of the week with null
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return weeks;
  };

  const calendarWeeks = generateCalendarWeeks();

  return (
    <View style={styles.container}>
      <View style={styles.dayNamesRow}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
          <View key={index} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{dayName}</Text>
          </View>
        ))}
      </View>

      {calendarWeeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.calendarRow}>
          {week.map((date, dayIndex) => {
            const status = date ? getDataStatusForDate(date) : 'none';
            const backgroundColor = date ? getStatusColor(status) : 'transparent';
            const dayTextColor = date
              ? (status === 'none' ? colors.textPrimary : colors.bgGradientFrom)
              : colors.textPrimary;
            
            return (
              <TouchableOpacity
                key={dayIndex}
                style={[styles.calendarCell, { backgroundColor }]}
                onPress={() => date && onDatePress && onDatePress(date)}
                disabled={!date}
              >
                {date && (
                  <Text style={[styles.dayText, { color: dayTextColor }]}>
                    {date.getDate()}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.costSales }]} />
          <Text style={styles.legendText}>Complete Data</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.accentPrimary }]} />
          <Text style={styles.legendText}>Partial Data</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]} />
          <Text style={styles.legendText}>No Data</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  calendarRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calendarCell: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default DataCalendar; 