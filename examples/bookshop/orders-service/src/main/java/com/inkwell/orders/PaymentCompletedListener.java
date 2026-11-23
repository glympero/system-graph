package com.inkwell.orders;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class PaymentCompletedListener {

    private final OrderRepository repository;

    public PaymentCompletedListener(OrderRepository repository) {
        this.repository = repository;
    }

    @KafkaListener(topics = "payments.completed", groupId = "orders-service")
    public void onPaymentCompleted(PaymentCompleted event) {
        repository.updateStatus(event.orderId(), "PAID");
    }
}
