import { FormEvent, useMemo, useState } from 'react';
import { ApiError, api } from './api';
import { formatSar } from './format';
import { orderTotal, parseSarToHalalas, validateOrder, type ItemInput } from '../../shared/orderInput';

type DraftItem = {
  key: string;
  name: string;
  quantity: string;
  price: string;
};

type Created = {
  id: string;
  customerName: string;
  customerEmail: string;
  totalHalalas: number;
  idempotencyKey: string;
  items: Array<{ name: string; quantity: number; unitHalalas: number }>;
};

function blankItem(): DraftItem {
  return { key: crypto.randomUUID(), name: '', quantity: '1', price: '' };
}

export function CreateOrder() {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ order: Created; replayed: boolean } | null>(null);

  const preview = useMemo(() => {
    const parsed: ItemInput[] = [];
    let complete = true;
    for (const item of items) {
      const quantity = Number(item.quantity);
      const unitHalalas = parseSarToHalalas(item.price);
      if (!Number.isInteger(quantity) || quantity < 1 || unitHalalas === null || item.name.trim() === '') {
        complete = false;
        continue;
      }
      parsed.push({ name: item.name.trim(), quantity, unitHalalas });
    }
    return {
      complete: complete && parsed.length === items.length,
      items: parsed,
      total: complete && parsed.length === items.length ? orderTotal(parsed) : null,
    };
  }, [items]);

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = validateOrder({
      customerName,
      customerEmail,
      items: items.map((item) => ({
        name: item.name,
        quantity: Number(item.quantity),
        unitHalalas: parseSarToHalalas(item.price) ?? -1,
      })),
      totalHalalas: preview.total ?? 0,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setPending(true);
    setErrors([]);
    try {
      const body = await api<{ order: Created; replayed: boolean }>('/api/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': submissionKey },
        body: JSON.stringify(parsed.value),
      });
      setCreated(body);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.errors.length > 0 ? caught.errors : [caught.message]);
        return;
      }
      setErrors(['The order was not saved. Submit again. This submission still counts as one order.']);
    } finally {
      setPending(false);
    }
  }

  function registerAnother() {
    setCustomerName('');
    setCustomerEmail('');
    setItems([blankItem()]);
    setSubmissionKey(crypto.randomUUID());
    setCreated(null);
    setErrors([]);
  }

  if (created) {
    return (
      <section className="ticket-result">
        <p className="oid">{created.order.idempotencyKey}</p>
        <h2>{created.replayed ? 'Already registered' : 'Registered'}</h2>
        <p className="sub">
          {created.replayed
            ? 'This submission was already an order. No second one was created.'
            : 'This submission is one order.'}
        </p>
        <p className="name">{created.order.customerName}</p>
        <p className="sub">{created.order.customerEmail}</p>
        <p className="amount">{formatSar(created.order.totalHalalas)} SAR</p>
        <p className="oid">{created.order.id}</p>
        <ul className="item-list">
          {created.order.items.map((item) => (
            <li key={item.name + item.quantity}>
              {item.quantity} × {item.name}
              <span className="num">{formatSar(item.quantity * item.unitHalalas)}</span>
            </li>
          ))}
        </ul>
        <button className="btn primary" type="button" onClick={registerAnother}>
          Register another
        </button>
      </section>
    );
  }

  return (
    <div className="create">
      <form className="order-form" onSubmit={onSubmit}>
        <label className="field">
          Customer
          <input className="input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
        </label>
        <label className="field">
          Email
          <input
            className="input"
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
          />
        </label>
        <div className="item-block">
          {items.map((item, index) => (
            <div className="item-row" key={item.key}>
              <label className="field">
                {index === 0 ? 'Item' : `Item ${index + 1}`}
                <input
                  className="input"
                  value={item.name}
                  onChange={(event) => updateItem(item.key, { name: event.target.value })}
                />
              </label>
              <label className="field">
                Qty
                <input
                  className="input"
                  inputMode="numeric"
                  value={item.quantity}
                  onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
                />
              </label>
              <label className="field">
                Price, SAR
                <input
                  className="input"
                  inputMode="decimal"
                  value={item.price}
                  onChange={(event) => updateItem(item.key, { price: event.target.value })}
                />
              </label>
              {items.length > 1 ? (
                <button className="btn ghost" type="button" onClick={() => setItems((rows) => rows.filter((row) => row.key !== item.key))}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          {items.length < 5 ? (
            <button className="btn" type="button" onClick={() => setItems((rows) => [...rows, blankItem()])}>
              Add an item
            </button>
          ) : null}
        </div>
        {errors.length > 0 ? (
          <div className="empty" role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Registering' : 'Register this order'}
        </button>
      </form>
      <aside className="ticket" aria-label="This submission">
        <p className="scope">Phone order</p>
        <p className="oid">{submissionKey}</p>
        <p className="name">{customerName.trim() || 'Customer'}</p>
        <ul className="item-list">
          {items.map((item) => {
            const unit = parseSarToHalalas(item.price);
            const quantity = Number(item.quantity);
            const line = unit !== null && Number.isInteger(quantity) && quantity > 0 ? unit * quantity : null;
            return (
              <li key={item.key}>
                <span>{item.name.trim() || 'Item'}</span>
                <span className="num">{line === null ? '—' : formatSar(line)}</span>
              </li>
            );
          })}
        </ul>
        <p className="amount">{preview.total === null ? '—' : formatSar(preview.total)}</p>
        <p className="sub">SAR. Sending this twice still creates one order.</p>
      </aside>
    </div>
  );
}
