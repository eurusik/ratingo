type Listener = () => void;

const listeners = new Set<Listener>();
let isPending = false;

function setPending(next: boolean): void {
  if (isPending === next) return;
  isPending = next;
  for (const listener of listeners) listener();
}

export const pendingReadAll = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  isPending: (): boolean => isPending,
  start: (): void => setPending(true),
  cancel: (): void => setPending(false),
};
