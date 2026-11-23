"""Extractor plugins. Each module has CONFIDENCE, BLIND_SPOTS and `extract(ctx) -> Iterable[Node | Edge]`.

To add one: write the module, then add it to REGISTRY.
"""
from sysgraph.extractors import (declared, express_routes, http_clients, k8s_scaling, kafka_code, spring_routes,
                                 sql_migrations, table_usage, terraform_pubsub)

REGISTRY = [express_routes, spring_routes, http_clients, kafka_code, sql_migrations, table_usage, k8s_scaling,
            terraform_pubsub, declared]


def name_of(module) -> str:
    return module.__name__.rsplit(".", 1)[-1]
