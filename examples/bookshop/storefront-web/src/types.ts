export interface Book {
  id: string;
  title: string;
  isbn: string;
  author: string;
  priceCents: number;
}

export interface SearchHit {
  id: string;
  title: string;
  score: number;
}

export interface CartLine {
  bookId: string;
  quantity: number;
}

export interface Order {
  id: string;
  status: 'PLACED' | 'PAID' | 'CANCELLED';
  lines: CartLine[];
}
