import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

const OWNER_READ_WRITE = 0o600;
const KEY_FILE_NAME = 'key.json';
const EXCLUSIVE_CREATE = 'wx';

export class PrivateCredentialsFile {
  private constructor(
    readonly path: string,
    private readonly directory: string,
  ) {}

  static async write(content: string, prefix: string): Promise<PrivateCredentialsFile> {
    const directory = await mkdtemp(path.join(tmpdir(), prefix));
    const file = path.join(directory, KEY_FILE_NAME);
    await writeFile(file, content, { mode: OWNER_READ_WRITE, flag: EXCLUSIVE_CREATE });
    return new PrivateCredentialsFile(file, directory);
  }

  async remove(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
  }
}
