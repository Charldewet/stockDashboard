import { AppRegistry } from 'react-native';
import App from './App.web';

AppRegistry.registerComponent('main', () => App);
AppRegistry.runApplication('main', {
  rootTag: document.getElementById('root'),
});

