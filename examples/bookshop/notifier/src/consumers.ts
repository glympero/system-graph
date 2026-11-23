import { Kafka } from 'kafkajs';
import { sendPaymentReceipt, sendWelcome } from './mail';
import { recordNotification } from './store';

const kafka = new Kafka({
  clientId: 'notifier',
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
});
const consumer = kafka.consumer({ groupId: 'notifier' });

export async function startConsumers(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topics: ['payments.completed', 'customers.registered'] });
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value?.toString() ?? '{}');
      if (topic === 'payments.completed') await sendPaymentReceipt(event);
      if (topic === 'customers.registered') await sendWelcome(event);
      await recordNotification(topic, event);
    },
  });
}
