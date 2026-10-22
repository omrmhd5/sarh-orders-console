export type Role = 'admin' | 'agent';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type OrderStatus = 'new' | 'confirmed' | 'fulfilled' | 'cancelled';

export type OrderSummary = {
  id: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  totalHalalas: number;
  createdAt: string;
};

export type OrderPage = {
  orders: OrderSummary[];
  nextCursor: string | null;
  total: number;
};
