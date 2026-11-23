package com.inkwell.payments;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// Added during the Black Friday incident so paid orders show up straight away.
// TODO: remove once orders-service reliably consumes payments.completed.
@Component
public class OrderStatusWriter {

    private final JdbcTemplate jdbc;

    public OrderStatusWriter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void markPaid(String orderId) {
        jdbc.update("UPDATE orders SET status = 'PAID' WHERE id = ?", orderId);
    }
}
