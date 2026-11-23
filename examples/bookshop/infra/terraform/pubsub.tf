# Event topics shared across services. Topic names match the names services use in code.

resource "google_pubsub_topic" "orders_placed" {
  name = "orders.placed"
}

resource "google_pubsub_topic" "catalog_book_updated" {
  name = "catalog.book-updated"
}

resource "google_pubsub_topic" "payments_completed" {
  name = "payments.completed"
}

resource "google_pubsub_topic" "payments_completed_dlq" {
  name = "payments.completed.dlq"
}

resource "google_pubsub_subscription" "notifier_payments_completed" {
  name  = "notifier-payments-completed"
  topic = google_pubsub_topic.payments_completed.id

  labels = {
    service = "notifier"
  }

  ack_deadline_seconds = 30

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.payments_completed_dlq.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_subscription" "search_catalog_updates" {
  name                    = "search-catalog-updates"
  topic                   = google_pubsub_topic.catalog_book_updated.id
  enable_message_ordering = true

  labels = {
    service = "search-service"
  }
}

resource "google_pubsub_subscription" "inventory_orders_placed" {
  name  = "inventory-orders-placed"
  topic = google_pubsub_topic.orders_placed.id

  labels = {
    service = "inventory-service"
  }
}
