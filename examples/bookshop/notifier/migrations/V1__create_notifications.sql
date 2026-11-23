CREATE SCHEMA IF NOT EXISTS notifier;

CREATE TABLE notifier.notifications (
    id          BIGSERIAL PRIMARY KEY,
    topic       TEXT NOT NULL,
    payload     JSONB NOT NULL,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
