import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  databases: {
    'serhafen-us': {
      host: process.env.DB_BU1_US_HOST ?? 'host.docker.internal',
      port: parseInt(process.env.DB_BU1_US_PORT ?? '5432', 10),
      username: process.env.DB_BU1_US_USERNAME ?? 'postgres',
      password: process.env.DB_BU1_US_PASSWORD,
      database: process.env.DB_BU1_US_DATABASE ?? 'serhafen_common',
      schema: process.env.DB_BU1_US_SCHEMA ?? 'us',
    },
    'serhafen-ag': {
      host: process.env.DB_BU1_AG_HOST ?? 'host.docker.internal',
      port: parseInt(process.env.DB_BU1_AG_PORT ?? '5432', 10),
      username: process.env.DB_BU1_AG_USERNAME ?? 'postgres',
      password: process.env.DB_BU1_AG_PASSWORD,
      database: process.env.DB_BU1_AG_DATABASE ?? 'serhafen_common',
      schema: process.env.DB_BU1_AG_SCHEMA ?? 'ag',
    },
    'serhafen-cl': {
      host: process.env.DB_BU2_CL_HOST ?? 'host.docker.internal',
      port: parseInt(process.env.DB_BU2_CL_PORT ?? '5432', 10),
      username: process.env.DB_BU2_CL_USERNAME ?? 'postgres',
      password: process.env.DB_BU2_CL_PASSWORD,
      database: process.env.DB_BU2_CL_DATABASE ?? 'serhafen_chile',
      schema: process.env.DB_BU2_CL_SCHEMA ?? 'cl',
    },
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
    max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    idle: parseInt(process.env.DB_POOL_IDLE ?? '10000', 10),
  },
}));
