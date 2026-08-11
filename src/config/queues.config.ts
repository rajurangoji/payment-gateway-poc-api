import { registerAs } from '@nestjs/config';

export default registerAs('queues', () => ({
  example: {
    name: process.env.SQS_DUMMY_QUEUE ?? 'dummy-queue',
  },
}));
