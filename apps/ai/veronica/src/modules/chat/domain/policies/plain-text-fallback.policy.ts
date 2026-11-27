import { PLAIN_TEXT_FALLBACK_MAX_CHARS } from '../constants/dume.constants';

import { clip, escapeHtml } from './answer-sanitizer.policy';

const TAG = /<[^>]*>/g;

const unescapeBasic = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

export const plainTextFallback = (html: string): string =>
  escapeHtml(clip(unescapeBasic(html.replace(TAG, '')), PLAIN_TEXT_FALLBACK_MAX_CHARS));
