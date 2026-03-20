import { registerAs } from '@nestjs/config';

export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  exchanges: {
    payment: 'payment.exchange',
    consent: 'consent.exchange',
    audit: 'audit.exchange',
    deadLetter: 'dlx.exchange'
  },
  queues: {
    paymentProcessing: {
      name: 'payment.processing.queue',
      options: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx.exchange',
          'x-max-priority': 10,
          'x-message-ttl': 86400000
        }
      }
    },
    consentManagement: {
      name: 'consent.management.queue',
      options: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx.exchange'
        }
      }
    },
    auditLogging: {
      name: 'audit.logging.queue',
      options: {
        durable: true
      }
    }
  },
  bindings: [
    {
      exchange: 'payment.exchange',
      queue: 'payment.processing.queue',
      routingKeys: ['payment.*']
    },
    {
      exchange: 'consent.exchange',
      queue: 'consent.management.queue',
      routingKeys: ['consent.*']
    }
  ]
}));