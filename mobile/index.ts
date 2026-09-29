// Polyfills first: the shared zustand stores read localStorage and call
// crypto.randomUUID() as soon as their modules load, before any route renders.
import './src/platform/polyfills';
import 'expo-router/entry';
