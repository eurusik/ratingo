type Listener = () => void;

const listeners = new Set<Listener>();
let activeToken = 0;
let nextToken = 0;

function notify(): void {
  for (const listener of listeners) listener();
}

export const pendingReadAll = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  isPending: (): boolean => activeToken !== 0,
  start(): number {
    nextToken += 1;
    activeToken = nextToken;
    notify();
    return activeToken;
  },
  finish(token: number): void {
    if (activeToken !== token) return;
    activeToken = 0;
    notify();
  },
};
