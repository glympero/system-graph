CREATE SCHEMA IF NOT EXISTS orders;

CREATE TABLE orders.orders (
    id           UUID PRIMARY KEY,
    customer_id  TEXT NOT NULL,
    status       VARCHAR(16) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders.order_items (
    order_id  UUID NOT NULL REFERENCES orders.orders (id),
    book_id   BIGINT NOT NULL,
    quantity  INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (order_id, book_id)
);
