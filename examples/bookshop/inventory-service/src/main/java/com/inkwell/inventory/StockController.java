package com.inkwell.inventory;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/stock")
public class StockController {

    private final StockRepository stock;
    private final LowStockPublisher lowStock;

    public StockController(StockRepository stock, LowStockPublisher lowStock) {
        this.stock = stock;
        this.lowStock = lowStock;
    }

    @GetMapping("/{sku}")
    public StockLevel get(@PathVariable String sku) {
        return stock.find(sku);
    }

    @PutMapping("/{sku}")
    public StockLevel set(@PathVariable String sku, @RequestBody SetStockRequest request) {
        stock.setQuantity(sku, request.quantity());
        if (request.quantity() < 5) {
            lowStock.publish(sku, request.quantity());
        }
        return stock.find(sku);
    }
}
