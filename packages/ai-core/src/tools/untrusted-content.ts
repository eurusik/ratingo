const CLOSING_TAG_PREFIX = /<\/(untrusted)/gi;
const LABEL_UNSAFE_CHARACTERS = /["<>\n\r]/g;

export function wrapUntrusted(label: string, content: string): string {
  const safeLabel = label.replace(LABEL_UNSAFE_CHARACTERS, '');
  return `<untrusted label="${safeLabel}">\n${content.replace(CLOSING_TAG_PREFIX, '<\\/$1')}\n</untrusted>`;
}
