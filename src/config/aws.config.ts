import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  region: process.env.AWS_REGION ?? 'us-east-1',
  sns: {
    useStaticCredentials:
      (process.env.SNS_USE_STATIC_CREDENTIALS ?? '').toLowerCase() === 'true' ||
      (!!process.env.SNS_ACCESS_KEY_ID && !!process.env.SNS_SECRET_ACCESS_KEY),
    accessKeyId: process.env.SNS_ACCESS_KEY_ID,
    secretAccessKey: process.env.SNS_SECRET_ACCESS_KEY,
    sessionToken: process.env.SNS_SESSION_TOKEN,
    endpoint: process.env.SNS_ENDPOINT,
  },
  sqs: {
    useStaticCredentials:
      (process.env.SQS_USE_STATIC_CREDENTIALS ?? '').toLowerCase() === 'true' ||
      (!!process.env.SQS_ACCESS_KEY_ID && !!process.env.SQS_SECRET_ACCESS_KEY),
    accessKeyId: process.env.SQS_ACCESS_KEY_ID,
    secretAccessKey: process.env.SQS_SECRET_ACCESS_KEY,
    sessionToken: process.env.SQS_SESSION_TOKEN,
    endpoint: process.env.SQS_ENDPOINT,
    defaultWaitTimeSeconds: Number(process.env.SQS_WAIT_TIME_SECONDS ?? 20),
    defaultMaxNumberOfMessages: Number(
      process.env.SQS_MAX_NUMBER_OF_MESSAGES ?? 10,
    ),
    defaultVisibilityTimeout: Number(process.env.SQS_VISIBILITY_TIMEOUT ?? 30),
  },
}));
