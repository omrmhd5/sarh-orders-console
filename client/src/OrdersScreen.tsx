import { useEffect, useRef, useState } from 'react';
import { ApiError, api, isAbort } from './api';
import { formatCount, formatPlaced, formatSar, statusLabel } from './format';
import { createRequestGate } from '../../shared/requestGate';
import type { OrderPage, OrderStatus, OrderSummary } from './types';

type StatusFilter = '' | OrderStatus;
type SortKey = 'created_at' | 'total';
type Direction = 'asc' | 'desc';

const TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: '', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'fulfilled', label: 'Fulfilled' },
  { id: 'cancelled', label: 'Cancelled' },
];

type OrdersScreenProps = {
  onUnauthorized: () => void;
};

export function OrdersScreen({ onUnauthorized }: OrdersScreenProps) {
  const gate = useRef(createRequestGate());
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [sort, setSort] = useState<SortKey>('created_at');
  const [dir, setDir] = useState<Direction>('desc');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cursorRef = useRef<string | null>(null);
  const filters = useRef({ q, status, sort, dir });
  filters.current = { q, status, sort, dir };

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const ticket = gate.current.start();
    const current = filters.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (current.q) params.set('q', current.q);
    if (current.status) params.set('status', current.status);
    params.set('sort', current.sort);
    params.set('dir', current.dir);

    api<OrderPage>(`/api/orders?${params.toString()}`, { signal: ticket.signal })
      .then((page) => {
        if (!ticket.isCurrent()) return;
        setOrders(page.orders);
        setTotal(page.total);
        setNextCursor(page.nextCursor);
        cursorRef.current = page.nextCursor;
      })
      .catch((caught: unknown) => {
        if (isAbort(caught) || !ticket.isCurrent()) return;
        if (caught instanceof ApiError && caught.status === 401) {
          onUnauthorized();
          return;
        }
        setError('The list did not load.');
      })
      .finally(() => {
        if (ticket.isCurrent()) setLoading(false);
      });

    return () => gate.current.cancel(ticket.id);
  }, [q, status, sort, dir, attempt, onUnauthorized]);

  async function loadMore() {
    const cursor = cursorRef.current;
    if (!cursor) return;
    const ticket = gate.current.start();
    const current = filters.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (current.q) params.set('q', current.q);
    if (current.status) params.set('status', current.status);
    params.set('sort', current.sort);
    params.set('dir', current.dir);
    params.set('cursor', cursor);
    try {
      const page = await api<OrderPage>(`/api/orders?${params.toString()}`, { signal: ticket.signal });
      if (!ticket.isCurrent()) return;
      setOrders((rows) => [...rows, ...page.orders]);
      setNextCursor(page.nextCursor);
      cursorRef.current = page.nextCursor;
    } catch (caught) {
      if (isAbort(caught) || !ticket.isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }
      setError('The next page did not load.');
    } finally {
      if (ticket.isCurrent()) setLoading(false);
    }
  }

  function onSort(next: SortKey) {
    if (sort === next) {
      setDir((value) => (value === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSort(next);
    setDir('desc');
  }

  const range =
    total === null
      ? 'Counting orders'
      : total === 0
        ? '0 orders'
        : `${formatCount(1)}–${formatCount(orders.length)} of ${formatCount(total)}`;

  const placedSort = sort === 'created_at' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const amountSort = sort === 'total' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Order status">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={status === tab.id}
            onClick={() => setStatus(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="filters">
        <label className="search">
          <span className="sr">Search customer name or email</span>
          <input
            className="input"
            type="search"
            placeholder="Name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <p className="stamp">
          {range}
          {loading && orders.length > 0 ? ' · Updating' : ''}
        </p>
      </div>

      {error ? (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button className="btn" type="button" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="table-wrap" aria-busy={loading}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Status</th>
              <th className="n" aria-sort={amountSort}>
                <button className="sort" type="button" onClick={() => onSort('total')}>
                  Amount, SAR
                </button>
              </th>
              <th className="n" aria-sort={placedSort}>
                <button className="sort" type="button" onClick={() => onSort('created_at')}>
                  Placed
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const placed = formatPlaced(order.createdAt);
              return (
                <tr key={order.id}>
                  <td>
                    <span className="name">{order.customerName}</span>
                    <span className="sub">{order.customerEmail}</span>
                    <span className="oid">{order.id}</span>
                  </td>
                  <td>
                    <span className={order.status === 'new' ? 'pill new' : 'pill'}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="n amount">{formatSar(order.totalHalalas)}</td>
                  <td className="n">
                    <span className="name">{placed.date}</span>
                    <span className="sub">{placed.time}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && orders.length === 0 ? (
          <div className="empty">
            <p>Loading orders</p>
          </div>
        ) : null}
        {!loading && orders.length === 0 && !error ? (
          <div className="empty">
            <p>No orders match this search.</p>
          </div>
        ) : null}
      </div>

      {nextCursor ? (
        <button className="btn load-more" type="button" onClick={loadMore} disabled={loading}>
          Load the next 50
        </button>
      ) : null}
    </>
  );
}
