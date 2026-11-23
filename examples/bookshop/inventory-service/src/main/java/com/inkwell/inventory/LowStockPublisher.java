package com.inkwell.inventory;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class LowStockPublisher {

    public static final String LOW_STOCK_TOPIC = "inventory.low-stock";

    private final KafkaTemplate<String, LowStock> kafkaTemplate;

    public LowStockPublisher(KafkaTemplate<String, LowStock> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(String sku, int quantity) {
        kafkaTemplate.send(LOW_STOCK_TOPIC, sku, new LowStock(sku, quantity));
    }
}
