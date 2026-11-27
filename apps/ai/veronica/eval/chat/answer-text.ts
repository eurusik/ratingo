const TAGS = /<[^>]+>/g;
const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};
const ENTITY = /&(?:amp|lt|gt|quot|#39);/g;

export const plainText = (html: string): string =>
  html.replace(TAGS, '').replace(ENTITY, (entity) => ENTITIES[entity] ?? entity);
