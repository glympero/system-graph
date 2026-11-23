import { Client } from '@elastic/elasticsearch';

const es = new Client({ node: process.env.ELASTIC_URL });
const INDEX = 'books';

export async function indexBook(book: { id: string; title: string; author: string }): Promise<void> {
  await es.index({ index: INDEX, id: String(book.id), document: book });
}

export async function search(query: string) {
  const result = await es.search({ index: INDEX, query: { multi_match: { query, fields: ['title^2', 'author'] } } });
  return result.hits.hits.map((hit) => ({ id: hit._id, score: hit._score, ...(hit._source as object) }));
}

export async function suggest(prefix: string) {
  const result = await es.search({ index: INDEX, size: 5, query: { match_phrase_prefix: { title: prefix } } });
  return result.hits.hits.map((hit) => hit._source);
}
