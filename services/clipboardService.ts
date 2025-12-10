export async function copyTextToClipboard(text: string): Promise<void> {
  const normalized = text?.trim();

  if (!normalized) {
    throw new Error('Nothing to copy');
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(normalized);
      return;
    } catch (error) {
      console.warn('Navigator clipboard copy failed, falling back to execCommand', error);
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API is unavailable in this environment');
  }

  const textArea = document.createElement('textarea');
  const activeElement = document.activeElement as HTMLElement | null;

  textArea.value = normalized;
  textArea.setAttribute('aria-hidden', 'true');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '-9999px';
  textArea.style.opacity = '0';
  textArea.style.pointerEvents = 'none';
  textArea.style.width = '0';
  textArea.style.height = '0';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  let successful = false;
  try {
    successful = document.execCommand('copy');
  } catch (error) {
    throw new Error('Copy command failed');
  } finally {
    document.body.removeChild(textArea);
    if (activeElement?.focus) {
      activeElement.focus();
    }
  }

  if (!successful) {
    throw new Error('Copy command was not successful');
  }
}
