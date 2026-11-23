"""One test per extractor: fixture files in, nodes and edges out."""
import unittest

from sysgraph.extractors import (declared, express_routes, http_clients, k8s_scaling, kafka_code, spring_routes,
                                 sql_migrations, table_usage, terraform_pubsub)
from tests.helpers import edges, nodes, repo


class ExpressRoutesTest(unittest.TestCase):
    def test_app_and_router_routes_become_endpoints(self):
        ctx = repo({"src/server.js": """\
            const app = express();
            app.get('/health', (req, res) => res.json({ ok: true }));
            const router = express.Router();
            router.put("/books/:id", update);
            """})
        out = list(express_routes.extract(ctx))
        self.assertEqual(edges(out), {
            ("service:shop", "endpoint:shop:GET /health", "exposes", "shop/src/server.js", 2),
            ("service:shop", "endpoint:shop:PUT /books/{id}", "exposes", "shop/src/server.js", 4),
        })
        node = nodes(out)["endpoint:shop:PUT /books/{id}"]
        self.assertEqual(node.props, {"service": "shop", "method": "PUT", "path": "/books/{id}"})


class HttpClientsTest(unittest.TestCase):
    def test_fetch_with_env_base_url_and_method(self):
        ctx = repo({"src/api.ts": """\
            const ORDERS = import.meta.env.VITE_ORDERS_SERVICE_URL;
            export const get = (id) => fetch(`${ORDERS}/orders/${id}?full=1`);
            export const place = (body) => fetch(`${ORDERS}/orders`, {
              method: 'POST',
              body,
            });
            """})
        self.assertEqual(edges(http_clients.extract(ctx)), {
            ("service:shop", "call:orders-service:GET /orders/{id}", "calls", "shop/src/api.ts", 2),
            ("service:shop", "call:orders-service:POST /orders", "calls", "shop/src/api.ts", 3),
        })

    def test_axios_instance(self):
        ctx = repo({"lib/api.ts": """\
            const catalog = axios.create({ baseURL: process.env.NEXT_PUBLIC_CATALOG_API_URL });
            export const remove = (id) => catalog.delete(`/books/${id}`);
            """})
        self.assertEqual(edges(http_clients.extract(ctx)), {
            ("service:shop", "call:catalog-api:DELETE /books/{id}", "calls", "shop/lib/api.ts", 2),
        })

    def test_spring_rest_client(self):
        ctx = repo({"src/PaymentsClient.java": """\
            public PaymentsClient(RestClient.Builder b, @Value("${PAYMENTS_SERVICE_URL}") String url) {
                this.restClient = b.baseUrl(url).build();
            }
            void charge() {
                restClient.post()
                    .uri("/payments/{id}", id)
                    .retrieve();
            }
            """})
        self.assertEqual(edges(http_clients.extract(ctx)), {
            ("service:shop", "call:payments-service:POST /payments/{id}", "calls", "shop/src/PaymentsClient.java", 5),
        })

    def test_env_aliases_override_the_naming_convention(self):
        ctx = repo({"a.js": "const API = process.env.LEGACY_HOST;\nfetch(`${API}/ping`);\n"},
                   env_aliases={"LEGACY_HOST": "catalog-api"})
        out = edges(http_clients.extract(ctx))
        self.assertEqual(out, {("service:shop", "call:catalog-api:GET /ping", "calls", "shop/a.js", 2)})


class SpringRoutesTest(unittest.TestCase):
    def test_class_prefix_is_joined_to_method_mappings(self):
        ctx = repo({"src/OrderController.java": """\
            @RestController
            @RequestMapping(path = "/orders")
            public class OrderController {
                @PostMapping
                public Order place() {}
                @GetMapping("/{id}")
                public Order get() {}
                @DeleteMapping(value = "/{id}/lines")
                public void clear() {}
            }
            """})
        f = "shop/src/OrderController.java"
        self.assertEqual(edges(spring_routes.extract(ctx)), {
            ("service:shop", "endpoint:shop:POST /orders", "exposes", f, 4),
            ("service:shop", "endpoint:shop:GET /orders/{id}", "exposes", f, 6),
            ("service:shop", "endpoint:shop:DELETE /orders/{id}/lines", "exposes", f, 8),
        })


class KafkaCodeTest(unittest.TestCase):
    def test_java_producer_with_constant_and_listener(self):
        ctx = repo({"src/Events.java": """\
            private static final String PLACED = "orders.placed";
            void send(Order o) { kafkaTemplate.send(PLACED, o.id(), o); }
            @KafkaListener(topics = {"payments.completed", "payments.failed"}, groupId = "x")
            void on(Object e) {}
            """})
        out = list(kafka_code.extract(ctx))
        f = "shop/src/Events.java"
        self.assertEqual(edges(out), {
            ("service:shop", "topic:orders.placed", "publishes", f, 2),
            ("service:shop", "topic:payments.completed", "subscribes", f, 3),
            ("service:shop", "topic:payments.failed", "subscribes", f, 3),
        })
        self.assertEqual(nodes(out)["topic:orders.placed"].type, "topic")

    def test_kafkajs_producer_and_consumer(self):
        ctx = repo({"src/bus.ts": """\
            await producer.send({ topic: 'catalog.book-updated', messages });
            await consumer.subscribe({ topics: ['a.one', "a.two"] });
            await consumer.subscribe({ topic: 'b.one', fromBeginning: true });
            """})
        self.assertEqual(edges(kafka_code.extract(ctx)), {
            ("service:shop", "topic:catalog.book-updated", "publishes", "shop/src/bus.ts", 1),
            ("service:shop", "topic:a.one", "subscribes", "shop/src/bus.ts", 2),
            ("service:shop", "topic:a.two", "subscribes", "shop/src/bus.ts", 2),
            ("service:shop", "topic:b.one", "subscribes", "shop/src/bus.ts", 3),
        })


class SqlMigrationsTest(unittest.TestCase):
    def test_create_table_gives_schema_and_table_nodes(self):
        ctx = repo({"db/migration/V1__init.sql": """\
            CREATE SCHEMA IF NOT EXISTS shop;

            CREATE TABLE shop.orders (id UUID);
            create table if not exists audit_log (id BIGINT);
            """, "db/seed.sql": "CREATE TABLE ignored (id INT);"})
        out = nodes(sql_migrations.extract(ctx))
        self.assertEqual(sorted(out), ["schema:public", "schema:shop", "table:public.audit_log", "table:shop.orders"])
        orders = out["table:shop.orders"]
        self.assertEqual((orders.name, orders.file, orders.line, orders.props),
                         ("shop.orders", "shop/db/migration/V1__init.sql", 3, {"schema": "shop", "table": "orders"}))


class TableUsageTest(unittest.TestCase):
    def test_sql_in_code_gives_reads_and_writes(self):
        ctx = repo({"src/Repo.java": """\
            jdbc.update("INSERT INTO orders (id) VALUES (?)", id);
            jdbc.query("SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id", m);
            jdbc.update("DELETE FROM sessions WHERE id = ?", id);
            jdbc.update("UPDATE shop.stock SET n = 1");
            """, "migrations/V1__x.sql": "INSERT INTO orders VALUES (1);"})
        f = "shop/src/Repo.java"
        self.assertEqual(edges(table_usage.extract(ctx)), {
            ("service:shop", "table:orders", "writes_table", f, 1),
            ("service:shop", "table:orders", "reads_table", f, 2),
            ("service:shop", "table:order_items", "reads_table", f, 2),
            ("service:shop", "table:sessions", "writes_table", f, 3),
            ("service:shop", "table:shop.stock", "writes_table", f, 4),
        })


class K8sScalingTest(unittest.TestCase):
    def test_deployment_hpa_and_pdb_become_service_props(self):
        ctx = repo({"k8s/orders.yaml": """\
            apiVersion: apps/v1
            kind: Deployment
            metadata:
              name: orders
            spec:
              replicas: 3
            ---
            kind: HorizontalPodAutoscaler
            spec:
              scaleTargetRef:
                name: orders
              minReplicas: 2
              maxReplicas: 5
              metrics:
                - type: Resource
                  resource:
                    name: cpu
            ---
            kind: PodDisruptionBudget
            spec:
              minAvailable: 2
              selector:
                matchLabels:
                  app: orders
            """}, name="infra", service=None)
        (svc,) = nodes(k8s_scaling.extract(ctx)).values()
        f = "infra/k8s/orders.yaml"
        self.assertEqual(svc.id, "service:orders")
        self.assertEqual(svc.props, {
            "deployment": {"replicas": 3, "file": f, "line": 6},
            "hpa": {"min": 2, "max": 5, "metrics": ["cpu"], "file": f, "line": 12},
            "pdb": {"min_available": 2, "file": f, "line": 21},
        })


class TerraformPubsubTest(unittest.TestCase):
    def test_topics_and_subscriptions_with_dead_letter_and_ordering(self):
        ctx = repo({"tf/pubsub.tf": """\
            resource "google_pubsub_topic" "paid" {
              name = "payments.completed"
            }
            resource "google_pubsub_subscription" "mail" {
              name  = "mail-paid"
              topic = google_pubsub_topic.paid.id
              enable_message_ordering = true
              labels = {
                service = "mailer"
              }
              dead_letter_policy {
                dead_letter_topic = "projects/p/topics/dlq"
              }
            }
            """}, name="infra", service=None)
        out = list(terraform_pubsub.extract(ctx))
        f = "infra/tf/pubsub.tf"
        self.assertEqual(sorted(nodes(out)), ["subscription:mail-paid", "topic:payments.completed"])
        self.assertEqual(nodes(out)["subscription:mail-paid"].props,
                         {"topic": "payments.completed", "ordered": True, "dead_letter_topic": "projects/p/topics/dlq",
                          "service": "mailer"})
        self.assertEqual(edges(out), {("subscription:mail-paid", "topic:payments.completed", "subscribes", f, 4)})


class DeclaredTest(unittest.TestCase):
    def test_architecture_file_gives_declared_edges_and_service_props(self):
        ctx = repo({"architecture.yaml": """\
            service: shop
            owner: web-team
            depends_on:
              - orders-service
              - search-service
            """})
        out = list(declared.extract(ctx))
        self.assertEqual(edges(out), {
            ("service:shop", "service:orders-service", "declared_dependency", "shop/architecture.yaml", 4),
            ("service:shop", "service:search-service", "declared_dependency", "shop/architecture.yaml", 5),
        })
        self.assertEqual(nodes(out)["service:shop"].props, {"owner": "web-team", "declares_dependencies": True})


if __name__ == "__main__":
    unittest.main()
