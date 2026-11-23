import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: 587 });

export async function sendPaymentReceipt(event: { email: string; orderId: string; amountCents: number }) {
  await transport.sendMail({
    to: event.email,
    subject: `Receipt for order ${event.orderId}`,
    text: `We received your payment of ${(event.amountCents / 100).toFixed(2)}.`,
  });
}

export async function sendWelcome(event: { email: string; name: string }) {
  await transport.sendMail({ to: event.email, subject: 'Welcome to Inkwell', text: `Hi ${event.name}, happy reading.` });
}
