package com.inkwell.payments;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/payments")
public class PaymentController {

    private final PaymentService payments;

    public PaymentController(PaymentService payments) {
        this.payments = payments;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Payment charge(@RequestBody ChargeRequest request) {
        return payments.charge(request);
    }

    @GetMapping("/{id}")
    public Payment get(@PathVariable String id) {
        return payments.get(id);
    }

    @PostMapping("/{id}/refund")
    public Payment refund(@PathVariable String id) {
        return payments.refund(id);
    }
}
