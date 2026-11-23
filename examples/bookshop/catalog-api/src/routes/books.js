const express = require('express');
const db = require('../db');
const events = require('../events');

const router = express.Router();
const PAGE_SIZE = 50;

router.get('/books', async (req, res) => {
  const page = Number(req.query.page || 1);
  const { rows } = await db.query(
    'SELECT b.id, b.title, b.isbn, b.price_cents, a.name AS author FROM books b JOIN authors a ON a.id = b.author_id ORDER BY b.title LIMIT $1 OFFSET $2',
    [PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  res.json(rows);
});

router.get('/books/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.sendStatus(404);
  res.json(rows[0]);
});

router.post('/books', async (req, res) => {
  const { title, isbn, authorId, priceCents } = req.body;
  const { rows } = await db.query(
    'INSERT INTO books (title, isbn, author_id, price_cents) VALUES ($1, $2, $3, $4) RETURNING *',
    [title, isbn, authorId, priceCents],
  );
  await events.bookUpdated(rows[0]);
  res.status(201).json(rows[0]);
});

router.put('/books/:id', async (req, res) => {
  const { title, isbn, authorId, priceCents } = req.body;
  const { rows } = await db.query(
    'UPDATE books SET title = $2, isbn = $3, author_id = $4, price_cents = $5 WHERE id = $1 RETURNING *',
    [req.params.id, title, isbn, authorId, priceCents],
  );
  await events.bookUpdated(rows[0]);
  res.json(rows[0]);
});

router.delete('/books/:id', async (req, res) => {
  await db.query('DELETE FROM books WHERE id = $1', [req.params.id]);
  res.sendStatus(204);
});

module.exports = router;
