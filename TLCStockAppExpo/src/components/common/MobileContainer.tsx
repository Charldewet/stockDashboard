import React from 'react';
import { View, ViewProps } from 'react-native';

interface MobileContainerProps extends ViewProps {
  children: React.ReactNode;
}

/**
 * Native pass-through component - no width constraints needed on mobile
 * The web version (MobileContainer.web.tsx) applies maxWidth constraint
 */
const MobileContainer: React.FC<MobileContainerProps> = ({ children, style, ...props }) => {
  return (
    <View style={style} {...props}>
      {children}
    </View>
  );
};

export default MobileContainer;

