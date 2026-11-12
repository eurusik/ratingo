export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

function isUserCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function shareLink(link: { url: string; title: string }): Promise<ShareOutcome> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share(link);
      return 'shared';
    }
    await navigator.clipboard.writeText(link.url);
    return 'copied';
  } catch (error) {
    if (!isUserCancel(error)) console.error('Sharing a title failed', { url: link.url, error });
    return 'cancelled';
  }
}
