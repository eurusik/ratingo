'use client';

import { createI18n } from '@ratingo/web-core/i18n';
import { getDictionary } from './config';

export const { I18nProvider, useTranslation, useLocale } = createI18n(getDictionary);
