CREATE SCHEMA IF NOT EXISTS catalog;

CREATE TABLE catalog.authors (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE catalog.books (
    id           BIGSERIAL PRIMARY KEY,
    title        TEXT NOT NULL,
    isbn         VARCHAR(13) NOT NULL UNIQUE,
    author_id    BIGINT NOT NULL REFERENCES catalog.authors (id),
    price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
