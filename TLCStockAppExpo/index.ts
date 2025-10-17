import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Use web-specific entry for web platform
let App;
if (Platform.OS === 'web') {
  App = require('./App.web').default;
} else {
  App = require('./App').default;
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
