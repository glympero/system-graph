package com.inkwell.inventory;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class StockRepository {

    private final JdbcTemplate jdbc;

    public StockRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public StockLevel find(String sku) {
        return jdbc.queryForObject("SELECT sku, quantity FROM stock WHERE sku = ?", StockLevel.MAPPER, sku);
    }

    public void setQuantity(String sku, int quantity) {
        jdbc.update("UPDATE stock SET quantity = ? WHERE sku = ?", quantity, sku);
    }

    @Transactional
    public Reservation reserve(List<ReservationLine> lines) {
        String id = UUID.randomUUID().toString();
        for (var line : lines) {
            jdbc.update("UPDATE stock SET quantity = quantity - ? WHERE sku = ?", line.quantity(), line.sku());
            jdbc.update("INSERT INTO reservations (id, sku, quantity) VALUES (?, ?, ?)", id, line.sku(), line.quantity());
        }
        return new Reservation(id, lines);
    }

    public void release(String id) {
        jdbc.update("DELETE FROM reservations WHERE id = ?", id);
    }
}
