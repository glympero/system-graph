const express = require('express');
const books = require('./routes/books');
const authors = require('./routes/authors');
const events = require('./events');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(books);
app.use(authors);

events.connect().then(() => {
  app.listen(process.env.PORT || 8080);
});
