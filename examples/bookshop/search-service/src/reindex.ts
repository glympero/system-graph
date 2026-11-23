// Nightly job: rebuild the index from the catalogue in case events were missed.
import { indexBook } from './index';

const CATALOG_API = process.env.CATALOG_API_URL;

async function reindex(): Promise<void> {
  for (let page = 1; ; page++) {
    const res = await fetch(`${CATALOG_API}/books?page=${page}`);
    const books = await res.json();
    if (books.length === 0) break;
    for (const book of books) await indexBook(book);
  }
}

reindex().catch((err) => {
  console.error(err);
  process.exit(1);
});
