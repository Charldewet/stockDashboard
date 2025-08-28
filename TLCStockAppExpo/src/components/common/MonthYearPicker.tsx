import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';


const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;

// Color scheme matching the app
const colors = {
  bgGradientFrom: '#111827',
  bgGradientTo: '#0F172A',
  surfacePrimary: '#1F2937',
  surfaceSecondary: '#111827',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accentPrimary: '#FF4500',
  accentPrimaryHover: '#E63E00',
  border: '#374151',
};

interface MonthYearPickerProps {
  visible: boolean;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  visible,
  currentDate,
  onDateSelect,
  onClose,
}) => {
  // iOS native spinner date
  const [tempDate, setTempDate] = useState<Date>(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));

  // Android custom wheels
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
  const monthScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYearVal = useMemo(() => new Date().getFullYear(), []);
  const years = useMemo(() => Array.from({ length: currentYearVal - 2018 }, (_, i) => 2019 + i), [currentYearVal]);
  
  useEffect(() => {
    if (!visible) return;
    // Sync iOS picker temp date
    setTempDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    // Sync Android wheels
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonth(currentDate.getMonth());

    if (Platform.OS === 'android') {
      setTimeout(() => {
        const monthIndex = currentDate.getMonth();
        monthScrollRef.current?.scrollTo({ y: monthIndex * ITEM_HEIGHT, animated: false });
        const yearIndex = years.findIndex(y => y === currentDate.getFullYear());
        if (yearIndex !== -1) {
          yearScrollRef.current?.scrollTo({ y: yearIndex * ITEM_HEIGHT, animated: false });
        }
      }, 80);
    }
  }, [visible, currentDate]);

  const handleDateChange = (_event: any, date?: Date) => {
    if (date) {
      setTempDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const handleConfirm = () => {
    if (Platform.OS === 'ios') {
      onDateSelect(tempDate);
    } else {
      onDateSelect(new Date(selectedYear, selectedMonth, 1));
    }
    onClose();
  };

  // Android wheel handlers
  const handleMonthScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, months.length - 1));
    if (clampedIndex !== selectedMonth) {
      setSelectedMonth(clampedIndex);
    }
  };

  const handleYearScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, years.length - 1));
    const year = years[clampedIndex];
    if (year && year !== selectedYear) {
      setSelectedYear(year);
    }
  };

  const snapToNearestMonth = () => {
    const index = selectedMonth;
    monthScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
  };

  const snapToNearestYear = () => {
    const index = years.findIndex(y => y === selectedYear);
    if (index !== -1) {
      yearScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    }
  };

  const renderMonthItems = () => {
    const paddedItems = [
      ...Array(Math.floor(VISIBLE_ITEMS / 2)).fill(''),
      ...months,
      ...Array(Math.floor(VISIBLE_ITEMS / 2)).fill('')
    ];

    return paddedItems.map((month, index) => {
      const actualIndex = index - Math.floor(VISIBLE_ITEMS / 2);
      const isInRange = actualIndex >= 0 && actualIndex < months.length;
      return (
        <View key={index} style={styles.pickerItem}>
          <Text style={[styles.pickerItemText, !isInRange && styles.hiddenText]}>
            {isInRange ? month : ''}
          </Text>
        </View>
      );
    });
  };

  const renderYearItems = () => {
    const paddedItems = [
      ...Array(Math.floor(VISIBLE_ITEMS / 2)).fill(''),
      ...years,
      ...Array(Math.floor(VISIBLE_ITEMS / 2)).fill('')
    ];

    return paddedItems.map((year, index) => {
      const actualIndex = index - Math.floor(VISIBLE_ITEMS / 2);
      const isInRange = actualIndex >= 0 && actualIndex < years.length;
      return (
        <View key={index} style={styles.pickerItem}>
          <Text style={[styles.pickerItemText, !isInRange && styles.hiddenText]}>
            {isInRange ? year : ''}
          </Text>
        </View>
      );
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Month & Year</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.datePickerContainer}>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(2020, 0, 1)}
                textColor={colors.textPrimary}
                style={styles.datePicker}
                themeVariant="dark"
                locale="en-US"
              />
            ) : (
              <View style={styles.pickersContainer}>
                <View style={styles.pickerSection}>
                  <Text style={styles.sectionLabel}>Month</Text>
                  <View style={styles.pickerWrapper}>
                    <View style={styles.pickerOverlay} />
                    <ScrollView
                      ref={monthScrollRef}
                      style={styles.picker}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.pickerContent}
                      onMomentumScrollEnd={handleMonthScroll}
                      onScrollEndDrag={snapToNearestMonth}
                      snapToInterval={ITEM_HEIGHT}
                      decelerationRate="fast"
                    >
                      {renderMonthItems()}
                    </ScrollView>
                  </View>
                </View>

                <View style={styles.pickerSection}>
                  <Text style={styles.sectionLabel}>Year</Text>
                  <View style={styles.pickerWrapper}>
                    <View style={styles.pickerOverlay} />
                    <ScrollView
                      ref={yearScrollRef}
                      style={styles.picker}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.pickerContent}
                      onMomentumScrollEnd={handleYearScroll}
                      onScrollEndDrag={snapToNearestYear}
                      snapToInterval={ITEM_HEIGHT}
                      decelerationRate="fast"
                    >
                      {renderYearItems()}
                    </ScrollView>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={styles.datePickerActions}>
            <TouchableOpacity style={styles.datePickerButton} onPress={onClose}>
              <Text style={styles.datePickerButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.datePickerButton, styles.datePickerButtonPrimary]}
              onPress={handleConfirm}
            >
              <Text style={[styles.datePickerButtonText, styles.datePickerButtonTextPrimary]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    margin: 20,
    width: '85%',
    maxHeight: screenHeight * 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.bgGradientFrom,
    borderRadius: 16,
    width: screenWidth * 0.9,
    maxHeight: '80%',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  datePickerContainer: {
    padding: 20,
    alignItems: 'center',
  },
  datePicker: {
    backgroundColor: colors.bgGradientFrom,
    width: 200,
    color: colors.textPrimary,
  },
  // Android custom wheels styles
  pickersContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  pickerSection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerWrapper: {
    position: 'relative',
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerOverlay: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.accentPrimary,
    backgroundColor: 'rgba(255, 69, 0, 0.1)',
    zIndex: 1,
    pointerEvents: 'none',
  },
  picker: {
    flex: 1,
  },
  pickerContent: {
    paddingVertical: 0,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pickerItemText: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
  },
  hiddenText: {
    opacity: 0,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 0,
  },
  datePickerButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 8,
    borderWidth: 0,
  },
  datePickerButtonPrimary: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  datePickerButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  datePickerButtonTextPrimary: {
    color: colors.textPrimary,
  },
});

export default MonthYearPicker; 