import { createServer, connect, type Server, type Socket } from 'node:net';

export interface StallingProxy {
  port: number;
  stall(): Promise<void>;
  close(): Promise<void>;
}

const listen = (server: Server): Promise<number> =>
  new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address !== null ? address.port : 0);
    });
  });

export const startStallingProxy = async (
  targetHost: string,
  targetPort: number,
): Promise<StallingProxy> => {
  const sockets: Socket[] = [];
  let stalled = false;
  const server = createServer((client) => {
    const upstream = connect(targetPort, targetHost);
    sockets.push(client, upstream);
    client.on('data', (chunk) => {
      if (!stalled) upstream.write(chunk);
    });
    upstream.on('data', (chunk) => {
      if (!stalled) client.write(chunk);
    });
    client.on('error', () => undefined);
    upstream.on('error', () => undefined);
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
  });
  const port = await listen(server);
  return {
    port,
    stall: async () => {
      stalled = true;
      server.close();
    },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};
