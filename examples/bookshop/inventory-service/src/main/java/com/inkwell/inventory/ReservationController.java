package com.inkwell.inventory;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = "/reservations")
public class ReservationController {

    private final StockRepository stock;

    public ReservationController(StockRepository stock) {
        this.stock = stock;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Reservation reserve(@RequestBody List<ReservationLine> lines) {
        return stock.reserve(lines);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void release(@PathVariable String id) {
        stock.release(id);
    }
}
