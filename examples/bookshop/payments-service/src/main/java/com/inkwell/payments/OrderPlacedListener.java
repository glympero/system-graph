package com.inkwell.payments;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class OrderPlacedListener {

    private final FraudCheck fraud;

    public OrderPlacedListener(FraudCheck fraud) {
        this.fraud = fraud;
    }

    @KafkaListener(topics = "orders.placed", groupId = "payments-service")
    public void onOrderPlaced(OrderPlaced event) {
        fraud.score(event);
    }
}
