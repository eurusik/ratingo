import { ALLOWED_REFS, DEFAULT_REF } from '../modules/investigation/public';

const REF_FLAG = '--ref=';

export type CliArguments =
  { ok: true; question: string; ref: string } | { ok: false; message: string };

export const parseCliArguments = (argv: readonly string[]): CliArguments => {
  let ref: string = DEFAULT_REF;
  const words: string[] = [];
  for (const argument of argv) {
    if (argument.startsWith(REF_FLAG)) ref = argument.slice(REF_FLAG.length);
    else if (argument.startsWith('--')) return { ok: false, message: `Unknown option ${argument}` };
    else words.push(argument);
  }
  if (!(ALLOWED_REFS as readonly string[]).includes(ref)) {
    return { ok: false, message: `The ref must be one of: ${ALLOWED_REFS.join(', ')}` };
  }
  const question = words.join(' ').trim();
  return question === ''
    ? { ok: false, message: 'A question is required.' }
    : { ok: true, question, ref };
};
