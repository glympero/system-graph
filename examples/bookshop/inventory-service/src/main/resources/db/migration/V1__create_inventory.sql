CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE inventory.stock (
    sku       VARCHAR(32) PRIMARY KEY,
    quantity  INTEGER NOT NULL CHECK (quantity >= 0)
);

CREATE TABLE inventory.reservations (
    id        UUID NOT NULL,
    sku       VARCHAR(32) NOT NULL REFERENCES inventory.stock (sku),
    quantity  INTEGER NOT NULL,
    PRIMARY KEY (id, sku)
);
