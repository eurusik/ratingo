'use client';

import { createI18n } from '@ratingo/web-core/i18n';
import type { Dictionary } from './dictionaries';

export const { I18nProvider, useTranslation } = createI18n<Dictionary>();
