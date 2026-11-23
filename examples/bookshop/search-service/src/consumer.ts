import { Kafka } from 'kafkajs';
import { indexBook } from './index';

const kafka = new Kafka({
  clientId: 'search-service',
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
});
const consumer = kafka.consumer({ groupId: 'search-service' });

export async function startConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: 'catalog.book-updated', fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (message.value) await indexBook(JSON.parse(message.value.toString()));
    },
  });
}
