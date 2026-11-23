import type { CartLine, Order } from '../types';

const ORDERS_URL = import.meta.env.VITE_ORDERS_SERVICE_URL;

export async function placeOrder(lines: CartLine[], customerId: string): Promise<Order> {
  const res = await fetch(`${ORDERS_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, lines }),
  });
  if (!res.ok) throw new Error(`orders ${res.status}`);
  return res.json();
}

export async function getOrder(id: string): Promise<Order> {
  const res = await fetch(`${ORDERS_URL}/orders/${id}`);
  if (!res.ok) throw new Error(`orders ${res.status}`);
  return res.json();
}
