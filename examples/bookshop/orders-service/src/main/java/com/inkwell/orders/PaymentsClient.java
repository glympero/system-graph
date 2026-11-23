package com.inkwell.orders;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class PaymentsClient {

    private final RestClient restClient;

    public PaymentsClient(RestClient.Builder builder, @Value("${PAYMENTS_SERVICE_URL}") String baseUrl) {
        this.restClient = builder.baseUrl(baseUrl).build();
    }

    public void charge(Order order) {
        restClient.post()
            .uri("/payments")
            .body(new ChargeRequest(order.id(), order.totalCents()))
            .retrieve()
            .toBodilessEntity();
    }

    record ChargeRequest(String orderId, long amountCents) {}
}
