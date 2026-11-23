package com.inkwell.orders;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class InventoryClient {

    private final RestClient restClient;

    public InventoryClient(RestClient.Builder builder, @Value("${INVENTORY_SERVICE_URL}") String baseUrl) {
        this.restClient = builder.baseUrl(baseUrl).build();
    }

    public void reserve(Order order) {
        restClient.post()
            .uri("/reservations")
            .body(order.lines())
            .retrieve()
            .toBodilessEntity();
    }
}
