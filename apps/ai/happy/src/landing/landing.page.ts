import { renderLandingPage, type StaticHtmlResponse } from '@ratingo/ai-core';

import { HAPPY_AVATAR_DATA_URI } from './happy-avatar';

export const HAPPY_LANDING_PAGE: StaticHtmlResponse = renderLandingPage({
  title: 'Happy · On Duty',
  accentColor: '#ff4a3a',
  avatarSrc: HAPPY_AVATAR_DATA_URI,
  language: 'uk',
  eyebrow: 'Stark Industries · Head of Security',
  readouts: [{ label: 'Access', value: 'Restricted' }],
});
