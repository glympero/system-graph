package com.inkwell.orders;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orders;

    public OrderController(OrderService orders) {
        this.orders = orders;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Order place(@RequestBody PlaceOrderRequest request) {
        return orders.place(request);
    }

    @GetMapping("/{id}")
    public Order get(@PathVariable String id) {
        return orders.get(id);
    }

    @GetMapping
    public List<Order> list(@RequestParam(required = false) String status) {
        return orders.list(status);
    }

    @PostMapping("/{id}/cancel")
    public Order cancel(@PathVariable String id) {
        return orders.cancel(id);
    }
}
