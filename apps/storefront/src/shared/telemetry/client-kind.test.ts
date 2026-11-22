import fc from 'fast-check';

import { classifyClientKind, isClientKind } from './client-kind';
import { CLIENT_KIND } from './constants';

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('classifyClientKind', () => {
  it.each([
    [
      'GPTBot',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
    ],
    ['ChatGPT-User', 'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)'],
    ['OAI-SearchBot', 'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)'],
    ['ClaudeBot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
    ['Claude-Web', 'Claude-Web/1.0'],
    ['anthropic-ai', 'anthropic-ai'],
    [
      'PerplexityBot',
      'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    ],
    ['Google-Extended', 'Google-Extended'],
    ['CCBot', 'CCBot/2.0 (https://commoncrawl.org/faq/)'],
    [
      'Bytespider',
      'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
    ],
    ['Applebot-Extended', 'Mozilla/5.0 (Macintosh) Applebot-Extended/0.1'],
    [
      'Amazonbot',
      'Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)',
    ],
    [
      'meta-externalagent',
      'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
    ],
  ])('classifies %s as an AI crawler', (_name, userAgent) => {
    expect(classifyClientKind(userAgent)).toBe(CLIENT_KIND.AI_CRAWLER);
  });

  it.each([
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
    ['YandexBot', 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'],
    ['DuckDuckBot', 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)'],
    [
      'Baiduspider',
      'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
    ],
    ['AhrefsBot', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
    ['SemrushBot', 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'],
    ['MJ12bot', 'Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)'],
    [
      'facebookexternalhit',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    ],
    ['Twitterbot', 'Twitterbot/1.0'],
    ['TelegramBot', 'TelegramBot (like TwitterBot)'],
    ['Slackbot', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
    ['WhatsApp', 'WhatsApp/2.23.20 A'],
    ['Discordbot', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'],
    ['curl', 'curl/8.4.0'],
    ['wget', 'Wget/1.21.4'],
    ['python-requests', 'python-requests/2.31.0'],
    ['Go-http-client', 'Go-http-client/2.0'],
    [
      'HeadlessChrome',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
    ],
    ['generic crawler', 'AcmeCrawler/1.0'],
    ['generic spider', 'SomeSpider 2.1'],
    ['generic bot', 'my-little-bot'],
  ])('classifies %s as a bot', (_name, userAgent) => {
    expect(classifyClientKind(userAgent)).toBe(CLIENT_KIND.BOT);
  });

  it.each([
    ['a desktop browser', CHROME],
    [
      'a mobile browser',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    ],
    ['a missing user agent', undefined],
    ['an empty user agent', ''],
  ])('classifies %s as human', (_name, userAgent) => {
    expect(classifyClientKind(userAgent)).toBe(CLIENT_KIND.HUMAN);
  });

  it('matches case-insensitively', () => {
    expect(classifyClientKind('GPTBOT')).toBe(CLIENT_KIND.AI_CRAWLER);
    expect(classifyClientKind('GOOGLEBOT/2.1')).toBe(CLIENT_KIND.BOT);
  });

  it('prefers AI crawler over the generic bot fallback', () => {
    expect(classifyClientKind('ClaudeBot')).toBe(CLIENT_KIND.AI_CRAWLER);
  });

  it('always returns one of the three kinds', () => {
    fc.assert(
      fc.property(fc.option(fc.string({ maxLength: 2000 }), { nil: undefined }), (userAgent) => {
        expect(Object.values(CLIENT_KIND)).toContain(classifyClientKind(userAgent));
      }),
    );
  });
});

describe('isClientKind', () => {
  it.each(['human', 'bot', 'ai_crawler'])('accepts %s', (value) => {
    expect(isClientKind(value)).toBe(true);
  });

  it.each(['Googlebot/2.1', '', 'HUMAN', undefined, 7, null])('rejects %p', (value) => {
    expect(isClientKind(value)).toBe(false);
  });
});
