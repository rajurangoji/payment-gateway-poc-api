// noinspection D

import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  databases: {
    'serhafen-us': {
      host: process.env.DB_BU1_US_HOST ?? 'localhost',
      port: parseInt(process.env.DB_BU1_US_PORT ?? '5432', 10),
      username: process.env.DB_BU1_US_USERNAME ?? 'postgres',
      password: process.env.DB_BU1_US_PASSWORD ?? 'password',
      database: process.env.DB_BU1_US_DATABASE ?? 'payment_poc',
      schema: process.env.DB_BU1_US_SCHEMA ?? 'us',
    },
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
    max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    idle: parseInt(process.env.DB_POOL_IDLE ?? '10000', 10),
  },
}));
