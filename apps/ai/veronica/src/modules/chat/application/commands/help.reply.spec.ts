import { renderHelp } from './help.reply';

describe('renderHelp', () => {
  it('says that Google Analytics questions are answered', () => {
    expect(renderHelp()).toContain('Google Analytics');
  });
});
