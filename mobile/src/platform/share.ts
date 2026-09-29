import { Share } from 'react-native';

// Native replacement for the web app's src/lib/share.ts (swapped in by
// metro.config.js): links point at the web app, shared through the iOS share
// sheet.

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://hevydrinkr.com';

export function getBaseUrl(): string {
  return SITE_URL;
}

export async function shareLink(url: string, title: string, text?: string): Promise<'shared' | 'cancelled' | 'copied'> {
  try {
    const result = await Share.share({ url, message: text, title });
    return result.action === Share.sharedAction ? 'shared' : 'cancelled';
  } catch {
    return 'cancelled';
  }
}
