/**
 * Format a date object to YYYY-MM-DD format in local timezone
 * @param {Date} date - The date to format
 * @returns {string} The formatted date string
 */
export const formatDateLocal = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date)) {
    throw new Error('Invalid date provided to formatDateLocal');
  }
  // Format in local timezone instead of UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get the start of the month for a given date
 * @param {Date} date - The date to get the start of month for
 * @returns {Date} The start of month date
 */
export const getMonthStart = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date)) {
    throw new Error('Invalid date provided to getMonthStart');
  }
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

/**
 * Get the same day in the previous year
 * @param {Date} date - The date to get the previous year for
 * @returns {Date} The same day in the previous year
 */
export const getPreviousYearSameMonth = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date)) {
    throw new Error('Invalid date provided to getPreviousYearSameMonth');
  }
  const prevYear = new Date(date);
  prevYear.setFullYear(prevYear.getFullYear() - 1);
  return prevYear;
};

/**
 * Get the same day of the week in the previous year
 * @param {Date} date - The date to get the previous year's day for
 * @returns {Date} The same day of the week in the previous year
 */
export const getPreviousYearSameDayOfWeek = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date)) {
    throw new Error('Invalid date provided to getPreviousYearSameDayOfWeek');
  }
  const prevYear = new Date(date);
  prevYear.setFullYear(prevYear.getFullYear() - 1);
  return prevYear;
};

/**
 * Get the month-to-date range (start of month to current date)
 * @param {Date} date - The date to get the range for
 * @returns {{startOfMonth: Date, endOfMonth: Date}} The date range
 */
export const getMonthToDateRange = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date)) {
    throw new Error('Invalid date provided to getMonthToDateRange');
  }
  return {
    startOfMonth: new Date(date.getFullYear(), date.getMonth(), 1),
    endOfMonth: date
  };
};

/**
 * Generate an array of date strings between two dates
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @returns {string[]} Array of date strings in YYYY-MM-DD format
 */
export const generateDateLabels = (startDate, endDate) => {
  if (!startDate || !endDate || !(startDate instanceof Date) || !(endDate instanceof Date) || isNaN(startDate) || isNaN(endDate)) {
    throw new Error('Invalid dates provided to generateDateLabels');
  }
  
  const dates = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(formatDateLocal(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}; 