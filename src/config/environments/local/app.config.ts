import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  meta: {
    name: process.env.APP_NAME ?? 'Catalyst Local API',
    version: process.env.APP_VERSION ?? '1.0.0',
  },
}));
