export function getBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export async function shareLink(url: string, title: string, text?: string) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ url, title, text });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }

  // Fallback: copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }

  return 'cancelled';
}
