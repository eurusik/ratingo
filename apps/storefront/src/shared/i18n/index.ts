export { DEFAULT_LOCALE, type Locale } from '@ratingo/web-core/i18n';
export { getDictionary, type Dictionary } from './dictionaries';
export { I18nProvider, useTranslation } from './i18n-context';
export { TranslationScope, type Namespace } from './translation-scope';
export { LOCALE_COOKIE, toLocale } from './locale-cookie';
export { useChangeLocale } from './use-change-locale';
export { interpolate } from './interpolate';
export { interpolateNodes } from './interpolate-nodes';
export { formatCount, formatNumber } from './format-count';
