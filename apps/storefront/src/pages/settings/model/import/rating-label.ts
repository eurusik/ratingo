const formats = new Map<string, Intl.NumberFormat>();

export function formatOwnRating(locale: string, rating: number): string {
  let format = formats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    formats.set(locale, format);
  }
  return format.format(rating);
}
