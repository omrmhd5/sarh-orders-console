export type ItemInput = {
  name: string;
  quantity: number;
  unitHalalas: number;
};

export type OrderInput = {
  customerName: string;
  customerEmail: string;
  items: ItemInput[];
  totalHalalas: number;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function lineHalalas(item: ItemInput): number {
  return item.quantity * item.unitHalalas;
}

export function orderTotal(items: ItemInput[]): number {
  return items.reduce((sum, item) => sum + lineHalalas(item), 0);
}

export function parseSarToHalalas(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function validateOrder(input: unknown): { ok: true; value: OrderInput } | { ok: false; errors: string[] } {
  if (!input || typeof input !== 'object') return { ok: false, errors: ['Enter the order.'] };
  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';
  if (customerName.length < 1 || customerName.length > 120) errors.push('Enter the customer name.');
  if (!EMAIL.test(customerEmail)) errors.push('Enter a valid email.');

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length < 1 || rawItems.length > 5) errors.push('Add between 1 and 5 items.');

  const items: ItemInput[] = [];
  rawItems.slice(0, 5).forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      errors.push(`Item ${index + 1} is incomplete.`);
      return;
    }
    const item = raw as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const quantity = item.quantity;
    const unitHalalas = item.unitHalalas;
    if (name.length < 1 || name.length > 80) errors.push(`Name item ${index + 1}.`);
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      errors.push(`Quantity for item ${index + 1} must be a whole number from 1 to 99.`);
    }
    if (typeof unitHalalas !== 'number' || !Number.isInteger(unitHalalas) || unitHalalas < 0) {
      errors.push(`Price for item ${index + 1} must be a positive amount.`);
    }
    if (
      name.length >= 1 &&
      typeof quantity === 'number' &&
      Number.isInteger(quantity) &&
      quantity >= 1 &&
      quantity <= 99 &&
      typeof unitHalalas === 'number' &&
      Number.isInteger(unitHalalas) &&
      unitHalalas >= 0
    ) {
      items.push({ name, quantity, unitHalalas });
    }
  });

  const totalHalalas = body.totalHalalas;
  if (typeof totalHalalas !== 'number' || !Number.isInteger(totalHalalas) || totalHalalas < 0) {
    errors.push('The amount has to be a whole number of halalas.');
  } else if (items.length === rawItems.length && totalHalalas !== orderTotal(items)) {
    errors.push('The amount does not match the items.');
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      customerName,
      customerEmail,
      items,
      totalHalalas: totalHalalas as number,
    },
  };
}
