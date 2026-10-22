export type RequestTicket = {
  id: number;
  signal: AbortSignal;
  isCurrent: () => boolean;
};

export function createRequestGate() {
  let latest = 0;
  let controller: AbortController | null = null;

  return {
    start(): RequestTicket {
      controller?.abort();
      const id = ++latest;
      const next = new AbortController();
      controller = next;
      return {
        id,
        signal: next.signal,
        isCurrent: () => id === latest,
      };
    },
    cancel(id: number) {
      if (id === latest) controller?.abort();
    },
  };
}
