const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/authors', async (req, res) => {
  const { rows } = await db.query('SELECT id, name FROM authors ORDER BY name');
  res.json(rows);
});

router.get('/authors/:id/books', async (req, res) => {
  const { rows } = await db.query('SELECT id, title FROM books WHERE author_id = $1', [req.params.id]);
  res.json(rows);
});

module.exports = router;
