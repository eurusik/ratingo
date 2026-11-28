import { sensitivePatternIn } from './sensitive-columns';

describe('sensitivePatternIn', () => {
  it.each([
    ['email', 'email'],
    ['contact_email', 'email'],
    ['password_hash', 'password'],
    ['session_token', 'token'],
    ['ip', 'ip'],
    ['client_ip', 'ip'],
    ['api_key', 'api_key'],
    ['provider_account_id_secret', 'secret'],
    ['reason_key', 'key'],
    ['push_endpoint', 'endpoint'],
    ['user_agent', 'user_agent'],
    ['Owner_Email', 'email'],
  ])('flags %s because of %s', (name, pattern) => {
    expect(sensitivePatternIn(name)).toBe(pattern);
  });

  it.each([
    'id',
    'title',
    'description',
    'tip_of_the_day',
    'ship_date',
    'created_at',
    'media_item_id',
    'keyword_count',
    'authored_at',
    'recipe',
  ])('does not flag %s', (name) => {
    expect(sensitivePatternIn(name)).toBeNull();
  });
});
