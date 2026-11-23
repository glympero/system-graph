package com.inkwell.orders;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class OrderEvents {

    private static final String ORDERS_PLACED = "orders.placed";

    private final KafkaTemplate<String, Order> kafkaTemplate;

    public OrderEvents(KafkaTemplate<String, Order> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void orderPlaced(Order order) {
        kafkaTemplate.send(ORDERS_PLACED, order.id(), order);
    }
}
