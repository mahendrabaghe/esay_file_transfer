export async function copyText(text) {
  if (!text) return false;
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to a temporary field when permission is blocked.
    }
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  document.body.appendChild(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  field.remove();
  return copied;
}

export async function readClipboard() {
  if (!navigator.clipboard?.readText || !window.isSecureContext) {
    throw new Error('Clipboard access needs HTTPS. Press and hold the field and choose Paste instead.');
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) throw new Error('Your clipboard is empty.');
    return text;
  } catch (error) {
    if (error.message === 'Your clipboard is empty.') throw error;
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      throw new Error('Clipboard permission was blocked. Press and hold the field and choose Paste.');
    }
    throw new Error('Could not read the clipboard. Press and hold the field and choose Paste.');
  }
}
