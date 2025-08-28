export const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateDisplay = (date: Date): string => {
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatDateShort = (date: Date): string => {
  return date.toLocaleDateString('en-ZA', {
    month: 'short',
    day: 'numeric'
  });
};

export const getPreviousYearSameDayOfWeek = (date: Date): Date => {
  const currentDate = new Date(date);
  const currentDayOfWeek = currentDate.getDay();
  const currentYear = currentDate.getFullYear();
  const previousYear = currentYear - 1;
  
  const targetDate = new Date(previousYear, currentDate.getMonth(), currentDate.getDate());
  const targetDayOfWeek = targetDate.getDay();
  
  const dayDifference = currentDayOfWeek - targetDayOfWeek;
  targetDate.setDate(targetDate.getDate() + dayDifference);
  
  return targetDate;
};

export const getYesterday = (): Date => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
};

export const getDateRange = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
};

export const getMonthStart = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

export const getMonthEnd = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

export const getYearStart = (date: Date): Date => {
  return new Date(date.getFullYear(), 0, 1);
};

export const getYearEnd = (date: Date): Date => {
  return new Date(date.getFullYear(), 11, 31);
};

export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export const isYesterday = (date: Date): boolean => {
  const yesterday = getYesterday();
  return date.toDateString() === yesterday.toDateString();
};

export const getDaysInMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

export const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

export const getWeekEnd = (date: Date): Date => {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
}; 