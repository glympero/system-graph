package com.inkwell.inventory;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class OrderPlacedListener {

    private final ReservationExpiry expiry;

    public OrderPlacedListener(ReservationExpiry expiry) {
        this.expiry = expiry;
    }

    @KafkaListener(topics = {"orders.placed"}, groupId = "inventory-service")
    public void onOrderPlaced(OrderPlaced event) {
        expiry.confirm(event.orderId());
    }
}
