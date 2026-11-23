package com.inkwell.payments;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class PaymentService {

    private final PaymentRepository repository;
    private final OrderStatusWriter orderStatus;
    private final OrdersClient orders;
    private final KafkaTemplate<String, PaymentCompleted> kafkaTemplate;

    public PaymentService(PaymentRepository repository, OrderStatusWriter orderStatus, OrdersClient orders,
                          KafkaTemplate<String, PaymentCompleted> kafkaTemplate) {
        this.repository = repository;
        this.orderStatus = orderStatus;
        this.orders = orders;
        this.kafkaTemplate = kafkaTemplate;
    }

    public Payment charge(ChargeRequest request) {
        OrderSummary order = orders.get(request.orderId());
        Payment payment = repository.insert(order.id(), request.amountCents());
        orderStatus.markPaid(order.id());
        kafkaTemplate.send("payments.completed", order.id(), new PaymentCompleted(order.id(), order.email(), request.amountCents()));
        return payment;
    }

    public Payment get(String id) {
        return repository.findById(id);
    }

    public Payment refund(String id) {
        repository.updateStatus(id, "REFUNDED");
        return repository.findById(id);
    }
}
