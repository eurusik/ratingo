import { renderHelp } from './help.reply';

describe('renderHelp', () => {
  it('says that Google Analytics questions are answered', () => {
    expect(renderHelp()).toContain('Google Analytics');
  });

  it('lists the command that starts a deep investigation', () => {
    expect(renderHelp()).toContain('/why');
  });
});
