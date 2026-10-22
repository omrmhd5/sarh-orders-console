import { useEffect, useState } from 'react';

export function App() {
  const [health, setHealth] = useState('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ ok: boolean }>;
      })
      .then((body) => setHealth(body.ok ? 'API is up' : 'API responded without ok'))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setHealth('API is not reachable');
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>SARH Orders</h1>
      <p>{health}</p>
    </main>
  );
}
