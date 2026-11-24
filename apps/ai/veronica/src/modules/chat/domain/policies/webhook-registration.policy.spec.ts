import { WebhookDecision, decideWebhookRegistration } from './webhook-registration.policy';

const desired = { url: 'https://v.example/webhooks/telegram', allowedUpdates: ['message'] };

describe('decideWebhookRegistration', () => {
  it('skips when the url and updates already match', () => {
    expect(
      decideWebhookRegistration({ url: desired.url, allowedUpdates: ['message'] }, desired),
    ).toBe(WebhookDecision.SKIP);
  });

  it.each([
    ['no webhook yet', { url: '', allowedUpdates: null }],
    ['another url', { url: 'https://old.example/hook', allowedUpdates: ['message'] }],
    ['default updates', { url: desired.url, allowedUpdates: null }],
    ['more updates', { url: desired.url, allowedUpdates: ['message', 'edited_message'] }],
    ['other updates', { url: desired.url, allowedUpdates: ['callback_query'] }],
    ['no updates', { url: desired.url, allowedUpdates: [] }],
  ])('registers on %s', (_name, current) => {
    expect(decideWebhookRegistration(current, desired)).toBe(WebhookDecision.REGISTER);
  });
});
