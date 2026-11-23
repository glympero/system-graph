CREATE SCHEMA IF NOT EXISTS payments;

CREATE TABLE payments.payments (
    id            UUID PRIMARY KEY,
    order_id      UUID NOT NULL,
    amount_cents  BIGINT NOT NULL,
    status        VARCHAR(16) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
