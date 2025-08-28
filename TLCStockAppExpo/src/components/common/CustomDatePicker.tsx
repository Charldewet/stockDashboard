import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

// Color scheme matching the app
const colors = {
  bgGradientFrom: '#111827',
  surfacePrimary: '#1F2937',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accentPrimary: '#FF4500',
  border: '#374151',
};

interface CustomDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  minimumDate = new Date(2020, 0, 1),
  maximumDate = new Date(),
}) => {
  const [currentMonth, setCurrentMonth] = useState<number>(value.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(value.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(value);

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get days in month
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const handleDateSelect = (day: number) => {
    if (day) {
      const newDate = new Date(currentYear, currentMonth, day);
      if (newDate >= minimumDate && newDate <= maximumDate) {
        setSelectedDate(newDate);
        onChange(newDate);
      }
    }
  };

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const isDateDisabled = (day: number) => {
    if (!day) return true;
    const date = new Date(currentYear, currentMonth, day);
    return date < minimumDate || date > maximumDate;
  };

  const isDateSelected = (day: number) => {
    if (!day) return false;
    return selectedDate.getDate() === day && 
           selectedDate.getMonth() === currentMonth && 
           selectedDate.getFullYear() === currentYear;
  };

  const calendarDays = generateCalendarDays();

  return (
    <View style={styles.container}>
      {/* Header with month/year and navigation */}
      <View style={styles.header}>
        <View style={styles.monthSection}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerText}>
            {months[currentMonth]}
          </Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.yearSection}>
          <TouchableOpacity onPress={() => setCurrentYear(currentYear - 1)} style={styles.navButton}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerText}>
            {currentYear}
          </Text>
          <TouchableOpacity onPress={() => setCurrentYear(currentYear + 1)} style={styles.navButton}>
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>



      {/* Days of week header */}
      <View style={styles.daysHeader}>
        {daysOfWeek.map((day, index) => (
          <View key={index} style={styles.dayHeader}>
            <Text style={styles.dayHeaderText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => (
                     <TouchableOpacity
             key={index}
             style={[
               styles.calendarDay,
               day && isDateSelected(day) ? styles.selectedDay : undefined,
               day && isDateDisabled(day) ? styles.disabledDay : undefined,
             ].filter(Boolean)}
             onPress={() => handleDateSelect(day || 0)}
             disabled={!day || isDateDisabled(day)}
           >
            {day && (
              <Text style={[
                styles.dayText,
                isDateSelected(day) && styles.selectedDayText,
                isDateDisabled(day) && styles.disabledDayText,
              ]}>
                {day}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.surfacePrimary,
    minWidth: 40,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 20,
    color: colors.accentPrimary,
    fontWeight: 'bold',
  },
  monthSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yearSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  daysHeader: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 8,
  },
  dayHeader: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginBottom: 10,
  },
  calendarDay: {
    width: '14.2857%', // 100% / 7 days
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  dayText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  selectedDay: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 8,
  },
  selectedDayText: {
    color: colors.bgGradientFrom,
    fontWeight: 'bold',
  },
  disabledDay: {
    opacity: 0.3,
  },
  disabledDayText: {
    color: colors.textSecondary,
  },
});

export default CustomDatePicker; 