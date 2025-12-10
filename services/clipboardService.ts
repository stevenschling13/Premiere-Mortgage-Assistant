export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text?.trim()) {
    throw new Error('Nothing to copy');
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API is unavailable in this environment');
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  textArea.style.pointerEvents = 'none';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const successful = document.execCommand('copy');
  document.body.removeChild(textArea);

  if (!successful) {
    throw new Error('Copy command was not successful');
  }
}
