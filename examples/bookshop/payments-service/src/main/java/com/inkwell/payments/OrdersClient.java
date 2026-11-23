package com.inkwell.payments;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OrdersClient {

    private final RestClient restClient;

    public OrdersClient(RestClient.Builder builder, @Value("${ORDERS_SERVICE_URL}") String baseUrl) {
        this.restClient = builder.baseUrl(baseUrl).build();
    }

    public OrderSummary get(String orderId) {
        return restClient.get()
            .uri("/orders/{id}", orderId)
            .retrieve()
            .body(OrderSummary.class);
    }
}
