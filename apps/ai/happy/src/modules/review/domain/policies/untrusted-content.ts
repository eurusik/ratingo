const CLOSING_TAG_PREFIX = /<\/(untrusted)/gi;

export const wrapUntrusted = (label: string, content: string): string =>
  `<untrusted label="${label}">\n${content.replace(CLOSING_TAG_PREFIX, '<\\/$1')}\n</untrusted>`;
