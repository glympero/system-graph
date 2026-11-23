package com.inkwell.orders;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OrderRepository {

    private final JdbcTemplate jdbc;

    public OrderRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Order insert(PlaceOrderRequest request) {
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO orders (id, customer_id, status) VALUES (?, ?, 'PLACED')", id, request.customerId());
        for (var line : request.lines()) {
            jdbc.update("INSERT INTO order_items (order_id, book_id, quantity) VALUES (?, ?, ?)",
                id, line.bookId(), line.quantity());
        }
        return findById(id);
    }

    public Order findById(String id) {
        return jdbc.queryForObject("SELECT id, customer_id, status FROM orders WHERE id = ?", Order.MAPPER, id);
    }

    public List<Order> findByStatus(String status) {
        return jdbc.query("SELECT id, customer_id, status FROM orders WHERE (? IS NULL OR status = ?)",
            Order.MAPPER, status, status);
    }

    public void updateStatus(String id, String status) {
        jdbc.update("UPDATE orders SET status = ? WHERE id = ?", status, id);
    }
}
