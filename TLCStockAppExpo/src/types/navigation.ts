import { StackNavigationProp } from '@react-navigation/stack';

export type AuthStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Data: undefined;
  Account: undefined;
  Reporting: undefined;
  Preferences: undefined;
};

export type DailyStackParamList = {
  DailyMain: undefined;
  DailyHistory: undefined;
};

export type MonthlyStackParamList = {
  MonthlyMain: undefined;
  MonthlyHistory: undefined;
};

export type StockStackParamList = {
  StockMain: undefined;
  StockHistory: undefined;
  StockDetail: undefined;
};

export type RootTabParamList = {
  Daily: undefined;
  Monthly: undefined;
  Yearly: undefined;
  Stock: undefined;
};

export type AuthNavigationProp = StackNavigationProp<AuthStackParamList>; 