const money = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const counts = new Intl.NumberFormat('en-GB');

export function formatSar(halalas: number): string {
  return money.format(halalas / 100);
}

export function formatCount(value: number): string {
  return counts.format(value);
}

export function formatPlaced(iso: string): { date: string; time: string } {
  if (iso.length < 16) return { date: '—', time: '' };
  return { date: iso.slice(0, 10), time: `${iso.slice(11, 16)} UTC` };
}

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}
