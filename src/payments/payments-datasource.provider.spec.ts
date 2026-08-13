import { DataSource } from 'typeorm';

import { PaymentsDataSourceProvider } from './payments-datasource.provider';

describe('PaymentsDataSourceProvider', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      DB_BU1_US_HOST: 'test-host',
      DB_BU1_US_PORT: '5433',
      DB_BU1_US_USERNAME: 'test-user',
      DB_BU1_US_PASSWORD: 'test-pass',
      DB_BU1_US_DATABASE: 'test-db',
      DB_BU1_US_SCHEMA: 'test-schema',
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('builds a DataSource from DB_BU1_US_* env vars', () => {
    const initializeSpy = jest
      .spyOn(DataSource.prototype, 'initialize')
      .mockImplementation(function (this: DataSource) {
        return Promise.resolve(this);
      });

    const provider = new PaymentsDataSourceProvider();
    const options = provider.buildOptions();

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'test-host',
      port: 5433,
      username: 'test-user',
      password: 'test-pass',
      database: 'test-db',
      schema: 'test-schema',
      synchronize: false,
    });

    initializeSpy.mockRestore();
  });

  it('returns the same DataSource instance on repeated calls (singleton, lazily initialized)', async () => {
    const initializeSpy = jest
      .spyOn(DataSource.prototype, 'initialize')
      .mockImplementation(function (this: DataSource) {
        return Promise.resolve(this);
      });

    const provider = new PaymentsDataSourceProvider();
    const first = await provider.getDataSource();
    const second = await provider.getDataSource();

    expect(first).toBe(second);
    expect(initializeSpy).toHaveBeenCalledTimes(1);

    initializeSpy.mockRestore();
  });
});
