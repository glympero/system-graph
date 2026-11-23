import axios from 'axios';

const catalog = axios.create({ baseURL: process.env.NEXT_PUBLIC_CATALOG_API_URL });
const inventory = axios.create({ baseURL: process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL });
const orders = axios.create({ baseURL: process.env.NEXT_PUBLIC_ORDERS_SERVICE_URL });

export interface BookInput {
  title: string;
  isbn: string;
  authorId: string;
  priceCents: number;
}

export const createBook = (book: BookInput) => catalog.post('/books', book);

export const updateBook = (id: string, book: BookInput) => catalog.put(`/books/${id}`, book);

export const deleteBook = (id: string) => catalog.delete(`/books/${id}`);

export const getStock = (sku: string) => inventory.get(`/stock/${sku}`);

export const setStock = (sku: string, quantity: number) => inventory.put(`/stock/${sku}`, { quantity });

export const listOrders = (status?: string) => orders.get('/orders', { params: { status } });

export const cancelOrder = (id: string) => orders.post(`/orders/${id}/cancel`);
