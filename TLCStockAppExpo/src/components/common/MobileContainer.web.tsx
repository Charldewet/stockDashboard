import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';

interface MobileContainerProps extends ViewProps {
  children: React.ReactNode;
}

/**
 * Web-specific container that constrains content to mobile width
 * On mobile/native, this component doesn't exist and won't be used
 */
const MobileContainer: React.FC<MobileContainerProps> = ({ children, style, ...props }) => {
  return (
    <View style={[styles.container, style]} {...props}>
      <View style={styles.inner}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    alignSelf: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 430, // Large mobile device width
  },
});

export default MobileContainer;

