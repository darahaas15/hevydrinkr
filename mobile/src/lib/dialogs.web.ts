// Browser stand-ins for the native alerts, used only by the web preview
// (`npm run web`); react-native-web has no Alert.prompt.
import type * as NativeDialogs from './dialogs';

export const confirmAction: typeof NativeDialogs.confirmAction = async (options) =>
  window.confirm([options.title, options.message].filter(Boolean).join('\n\n'));

export const promptText: typeof NativeDialogs.promptText = async (options) =>
  window.prompt([options.title, options.message].filter(Boolean).join('\n\n'), options.defaultValue ?? '');
