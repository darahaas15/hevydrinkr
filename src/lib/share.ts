export function getBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export async function shareLink(url: string, title: string, text?: string) {
  if (navigator.share) {
    try {
      await navigator.share({ url, title, text });
    } catch {}
  } else {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
  return 'shared';
}
