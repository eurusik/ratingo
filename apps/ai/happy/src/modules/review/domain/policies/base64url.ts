const BASE64_PLUS = /\+/g;
const BASE64_SLASH = /\//g;
const BASE64_PADDING = /=+$/;

export const toBase64Url = (text: string): string =>
  btoa(Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join(''))
    .replace(BASE64_PLUS, '-')
    .replace(BASE64_SLASH, '_')
    .replace(BASE64_PADDING, '');
