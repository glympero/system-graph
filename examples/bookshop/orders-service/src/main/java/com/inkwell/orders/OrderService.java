package com.inkwell.orders;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private final OrderRepository repository;
    private final InventoryClient inventory;
    private final PaymentsClient payments;
    private final OrderEvents events;

    public OrderService(OrderRepository repository, InventoryClient inventory, PaymentsClient payments, OrderEvents events) {
        this.repository = repository;
        this.inventory = inventory;
        this.payments = payments;
        this.events = events;
    }

    @Transactional
    public Order place(PlaceOrderRequest request) {
        Order order = repository.insert(request);
        inventory.reserve(order);
        payments.charge(order);
        events.orderPlaced(order);
        return order;
    }

    public Order get(String id) {
        return repository.findById(id);
    }

    public List<Order> list(String status) {
        return repository.findByStatus(status);
    }

    public Order cancel(String id) {
        repository.updateStatus(id, "CANCELLED");
        return repository.findById(id);
    }
}
