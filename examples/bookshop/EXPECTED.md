# Planted problems in the bookshop estate

Inkwell is a fictional online bookshop. Its nine repos are small but realistic, and a few problems were planted on
purpose so every rule has something to find. `tests/test_rules.py` asserts that a build of this estate produces exactly
the findings below, no more and no less.

| Finding id | Label | What was planted |
|---|---|---|
| `R1:topic:inventory.low-stock` | Gap | inventory-service publishes low-stock events that nobody consumes |
| `R2:topic:customers.registered` | Gap | notifier waits for sign-up events that no service publishes |
| `R3:table:orders.orders` | Bad | payments-service writes the orders table directly (`OrderStatusWriter`) |
| `R4:service:orders-service>service:payments-service` | Bad | orders calls payments to charge, payments calls orders back to read the order |
| `R5:service:search-service>service:catalog-api` | Gap | the nightly reindex job calls catalog-api, the architecture file says no dependencies |
| `R5:service:storefront-web>service:inventory-service` | Gap | storefront-web still declares inventory-service, the code no longer calls it |
| `R6:service:notifier` | Gap | notifier has a Deployment with one replica and no autoscaler |
| `R6:service:payments-service` | Gap | the payments autoscaler is pinned at 3 to 3 |
| `R7:service:inventory-service` | Bad | the PDB needs 2 available pods and the service only runs 2, so a node drain blocks |
| `R8:subscription:notifier-payments-completed` | Good | the receipt subscription has a dead-letter topic |
| `R8:subscription:search-catalog-updates` | Bad | the ordered search subscription has no dead-letter topic, one poison message stalls it |
