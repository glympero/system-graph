package com.inkwell.payments;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PaymentRepository {

    private final JdbcTemplate jdbc;

    public PaymentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Payment insert(String orderId, long amountCents) {
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO payments (id, order_id, amount_cents, status) VALUES (?, ?, ?, 'CAPTURED')",
            id, orderId, amountCents);
        return findById(id);
    }

    public Payment findById(String id) {
        return jdbc.queryForObject("SELECT id, order_id, amount_cents, status FROM payments WHERE id = ?", Payment.MAPPER, id);
    }

    public void updateStatus(String id, String status) {
        jdbc.update("UPDATE payments SET status = ? WHERE id = ?", status, id);
    }
}
