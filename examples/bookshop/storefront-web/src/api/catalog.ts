import type { Book, SearchHit } from '../types';

const CATALOG_API_URL = import.meta.env.VITE_CATALOG_API_URL;
const SEARCH_URL = import.meta.env.VITE_SEARCH_SERVICE_URL;

export async function listBooks(page = 1): Promise<Book[]> {
  const res = await fetch(`${CATALOG_API_URL}/books?page=${page}`);
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  return res.json();
}

export async function getBook(id: string): Promise<Book> {
  const res = await fetch(`${CATALOG_API_URL}/books/${id}`);
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  return res.json();
}

export async function searchBooks(query: string): Promise<SearchHit[]> {
  const res = await fetch(`${SEARCH_URL}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`search ${res.status}`);
  return res.json();
}
