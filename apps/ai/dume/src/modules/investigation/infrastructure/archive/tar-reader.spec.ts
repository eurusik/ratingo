import { InvalidTarError, TarEntryType, readTarStream, type TarEntry } from './tar-reader';
import { buildTar, chunked, paxRecords, tarEntry } from '../testing/tar-builder.testing';

const collect = async (
  archive: Buffer,
  chunkSize: number,
  skip: (entry: TarEntry) => boolean = () => false,
) => {
  const received: { path: string; body: string }[] = [];
  const decided: TarEntry[] = [];
  await readTarStream(chunked(archive, chunkSize), {
    decide: (entry) => {
      decided.push(entry);
      return skip(entry) ? 'skip' : 'read';
    },
    receive: (entry, body) => {
      received.push({ path: entry.path, body: body.toString('utf8') });
    },
  });
  return { received, decided };
};

describe('readTarStream', () => {
  const archive = buildTar([
    tarEntry({ name: 'pax_global_header', flag: 'g', body: paxRecords({ comment: 'abc' }) }),
    tarEntry({ name: 'root/', flag: '5' }),
    tarEntry({ name: 'root/a.txt', body: 'hello\nworld\n' }),
    tarEntry({ name: 'root/link', flag: '2' }),
    tarEntry({ name: 'root/empty.txt', body: '' }),
    tarEntry({ name: 'b.txt', prefix: 'root/deep', body: 'x'.repeat(1300) }),
  ]);

  it.each([1, 7, 512, 513, 100_000])(
    'reads regular files whatever the chunk size (%i)',
    async (chunkSize) => {
      const { received } = await collect(archive, chunkSize);

      expect(received.map((file) => file.path)).toEqual([
        'root/a.txt',
        'root/empty.txt',
        'root/deep/b.txt',
      ]);
      expect(received[0]?.body).toBe('hello\nworld\n');
      expect(received[2]?.body).toHaveLength(1300);
    },
  );

  it('asks the visitor only about regular files', async () => {
    const { decided } = await collect(archive, 4096);

    expect(decided.map((entry) => [entry.path, entry.type])).toEqual([
      ['root/a.txt', TarEntryType.FILE],
      ['root/empty.txt', TarEntryType.FILE],
      ['root/deep/b.txt', TarEntryType.FILE],
    ]);
  });

  it('uses a pax path for names that do not fit the header', async () => {
    const longName = `root/${'d'.repeat(150)}/file.ts`;
    const { received } = await collect(
      buildTar([
        tarEntry({ name: 'PaxHeader', flag: 'x', body: paxRecords({ path: longName }) }),
        tarEntry({ name: 'short', body: 'long path body' }),
      ]),
      333,
    );

    expect(received).toEqual([{ path: longName, body: 'long path body' }]);
  });

  it('does not buffer a body the visitor skipped', async () => {
    const { received, decided } = await collect(archive, 64, (entry) =>
      entry.path.endsWith('a.txt'),
    );

    expect(decided).toHaveLength(3);
    expect(received.map((file) => file.path)).toEqual(['root/empty.txt', 'root/deep/b.txt']);
  });

  it('rejects a pax size that is not a whole number instead of hanging', async () => {
    const hostile = buildTar([
      tarEntry({ name: 'PaxHeader', flag: 'x', body: paxRecords({ size: 'abc' }) }),
      tarEntry({ name: 'file', body: 'x' }),
    ]);

    await expect(collect(hostile, 512)).rejects.toBeInstanceOf(InvalidTarError);
  });

  it('rejects a corrupt header and a truncated archive', async () => {
    const corrupt = Buffer.from(archive);
    corrupt[10] = 0x41;
    await expect(collect(corrupt, 512)).rejects.toBeInstanceOf(InvalidTarError);
    await expect(collect(archive.subarray(0, 700), 512)).rejects.toBeInstanceOf(InvalidTarError);
  });
});
