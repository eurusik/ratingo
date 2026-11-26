import { AsyncLocalStorage } from 'node:async_hooks';

export type LogContextFields = Readonly<Record<string, string | number | boolean>>;

const storage = new AsyncLocalStorage<LogContextFields>();

export const runWithLogContext = <T>(fields: LogContextFields, callback: () => T): T =>
  storage.run({ ...storage.getStore(), ...fields }, callback);

export const getLogContext = (): LogContextFields => storage.getStore() ?? {};
