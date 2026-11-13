'use client';

import { createI18n } from '@ratingo/web-core/i18n';
import type { TranslationKeys } from './config';

export const { I18nProvider, useTranslation, useLocale } = createI18n<TranslationKeys>();
