const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'catalog-api',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});
const producer = kafka.producer();

async function connect() {
  await producer.connect();
}

async function bookUpdated(book) {
  await producer.send({
    topic: 'catalog.book-updated',
    messages: [{ key: String(book.id), value: JSON.stringify(book) }],
  });
}

module.exports = { connect, bookUpdated };
