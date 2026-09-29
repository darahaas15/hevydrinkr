import { Alert, type KeyboardTypeOptions } from 'react-native';

/** A native confirmation alert. Resolves true when the user confirms. */
export function confirmAction(options: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: options.cancelLabel ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmLabel,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/**
 * A native text-entry alert. Resolves the entered text, or null if cancelled.
 * `clearLabel` adds a destructive button that resolves an empty string.
 */
export function promptText(options: {
  title: string;
  message?: string;
  defaultValue?: string;
  confirmLabel?: string;
  clearLabel?: string;
  keyboardType?: KeyboardTypeOptions;
}): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.prompt(
      options.title,
      options.message,
      [
        ...(options.clearLabel
          ? [{ text: options.clearLabel, style: 'destructive' as const, onPress: () => resolve('') }]
          : []),
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: options.confirmLabel ?? 'Save', onPress: (value?: string) => resolve(value ?? '') },
      ],
      'plain-text',
      options.defaultValue,
      options.keyboardType,
    );
  });
}
