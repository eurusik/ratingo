import { renderLandingPage, type StaticHtmlResponse } from '@ratingo/ai-core';

import { VERONICA_AVATAR_DATA_URI } from './veronica-avatar';

export const VERONICA_LANDING_PAGE: StaticHtmlResponse = renderLandingPage({
  title: 'Veronica',
  accentColor: '#4cc9f0',
  avatarSrc: VERONICA_AVATAR_DATA_URI,
  language: 'uk',
  eyebrow: 'Anti-Hulk Protocol',
  readouts: [{ label: 'Status', value: 'Standing by' }],
});
