import { HttpModule, HttpService } from '@nestjs/axios';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ICircuitHttpClient } from '@shared';
import { createCircuitBreakerClient } from '@shared/http/circuit.factory';

import { SAMPLE_HTTP_CLIENT } from '../clients.token';

import { SampleClient } from './sample.client';
import { SampleClientConfig } from './sample.client.config';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (sampleClientConfig: SampleClientConfig) => ({
        baseURL: sampleClientConfig.baseURL,
        timeout: sampleClientConfig.circuitBreaker.timeout,
        headers: { 'Content-Type': 'application/json' },
      }),
      inject: [SampleClientConfig],
    }),
  ],
  providers: [
    SampleClient,
    {
      provide: SAMPLE_HTTP_CLIENT,
      useFactory: (
        httpService: HttpService,
        sampleClientConfig: SampleClientConfig,
      ): ICircuitHttpClient => {
        const logger = new Logger('SampleHttpClientCircuitBreaker');
        const breakerOptions = {
          timeout: sampleClientConfig.circuitBreaker.timeout, // If our function takes longer than 10 seconds, trigger a failure
          errorThresholdPercentage:
            sampleClientConfig.circuitBreaker.errorThresholdPercentage, // When 50% of requests fail, trip the circuit
          resetTimeout: sampleClientConfig.circuitBreaker.resetTimeout, // After 30 seconds, try again.
          rollingCountTimeout:
            sampleClientConfig.circuitBreaker.rollingCountTimeout, // The duration of the statistical rolling window, in milliseconds. Default is 10000 (10 seconds).
          rollingCountBuckets:
            sampleClientConfig.circuitBreaker.rollingCountBuckets, // The number of buckets the rolling window is divided into. Default is 10.
          volumeThreshold: sampleClientConfig.circuitBreaker.volumeThreshold, // Minimum number of requests before tripping. Default is 5.
        };
        return createCircuitBreakerClient(httpService, breakerOptions, logger);
      },
      inject: [HttpService, SampleClientConfig],
    },
  ],
  exports: [SampleClient],
})
export class SampleClientModule {}
