'use client';

import { createI18n } from '@ratingo/web-core/i18n';
import { getDictionary } from './dictionaries';

export const { I18nProvider, useTranslation } = createI18n(getDictionary);
