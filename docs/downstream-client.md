# Creating a Client Class for Downstream Requests

Create a client class for making downstream HTTP requests in this project, leveraging the
circuit breaker client and automatic trace header propagation.

## 1. Use the Circuit Breaker HTTP Client

All downstream HTTP requests should be made using the `ICircuitHttpClient` interface, which is provided by the
`createCircuitBreakerClient` factory. This ensures resilience, observability, and consistent error handling.

## 2. Inject the Circuit Breaker Client

In your client class, inject the circuit breaker client using the appropriate injection token. For example:

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ICircuitHttpClient } from 'path-to-shared';
import { SAMPLE_HTTP_CLIENT } from 'path-to-clients.token';

@Injectable()
export class SampleClient {
  private readonly logger = new Logger('SampleClient');

  constructor(
    @Inject(SAMPLE_HTTP_CLIENT)
    private readonly httpClient: ICircuitHttpClient,
  ) {
  }

  async getOk(): Promise<string> {
    this.logger.log('Fetching /ok endpoint');
    return this.httpClient.get<string>('/ok');
  }

  async postOk(data: { message: string }): Promise<string> {
    this.logger.log(`Posting to /ok endpoint with data: ${JSON.stringify(data)}`);
    return this.httpClient.post<string, { message: string }>('/ok', data);
  }
}
```

## 3. Automatic Trace Header Injection

The circuit breaker client is configured to automatically propagate the `traceparent` header (W3C Trace Context) on all
outgoing HTTP requests. This enables distributed tracing across services without manual intervention.

- The `traceparent` header is extracted from the current request context (using OpenTelemetry or similar
  instrumentation) and injected into all downstream requests.
- This is handled transparently by the HTTP client layer, so you do not need to set the header manually in your client
  classes.

## 4. Best Practices

- **Always use the injected circuit breaker client for HTTP calls.**
- **Do not use `HttpService` directly** in your client classes; this bypasses resilience and tracing features.
- **Log requests and responses** for observability, but avoid logging sensitive data.
- **Handle errors gracefully** and surface meaningful messages to upstream callers.

## 5. Example Module Registration

Register your client and its circuit breaker provider in a module:

```typescript

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    SampleClient,
    {
      provide: SAMPLE_HTTP_CLIENT,
      useFactory: (httpService, configService) => {
        // ...create breakerOptions...
        return createCircuitBreakerClient(httpService, breakerOptions, new Logger('SampleHttpClientCircuitBreaker'));
      },
      inject: [HttpService, ConfigService],
    },
  ],
  exports: [SampleClient],
})
export class SampleClientModule {
}
```

## Circuit Breaker Configuration Explained

The circuit breaker uses several configuration options to control its behavior. Here is what each option means:

| Option                     | Description                                                                     | Example Value |
|----------------------------|---------------------------------------------------------------------------------|---------------|
| `timeout`                  | Time in ms before a single request is considered failed (timeout).              | `10000`       |
| `errorThresholdPercentage` | Percentage of failed requests (in the rolling window) to trip the circuit.      | `50`          |
| `resetTimeout`             | Time in ms to wait before trying requests again after the circuit is opened.    | `30000`       |
| `rollingCountTimeout`      | Duration in ms of the rolling statistical window for error calculation.         | `10000`       |
| `rollingCountBuckets`      | Number of buckets the rolling window is divided into (for more granular stats). | `10`          |
| `volumeThreshold`          | Minimum number of requests in the rolling window before the circuit can trip.   | `5`           |

### How They Work Together

- **timeout**: If a downstream request takes longer than this, it is considered a failure.
- **rollingCountTimeout** and **rollingCountBuckets**: The circuit breaker keeps stats for the last
  `rollingCountTimeout` ms, divided into `rollingCountBuckets` (e.g., 10 seconds, 10 buckets = 1 second per bucket).
- **volumeThreshold**: The circuit breaker will not open until at least this many requests have been made in the rolling
  window.
- **errorThresholdPercentage**: If the percentage of failed requests in the rolling window exceeds this value, the
  circuit opens (blocks requests).
- **resetTimeout**: After the circuit opens, it will wait this long before allowing a test request to see if the
  downstream service has recovered.

### Example Configuration (YAML or .env)

You can set these values in your configuration files or environment variables. Here is an example using environment
variables:

```env
# .env or environment variables
CLIENTS_SAMPLE_CIRCUITBREAKER_TIMEOUT=10000
CLIENTS_SAMPLE_CIRCUITBREAKER_ERRORTHRESHOLDPERCENTAGE=50
CLIENTS_SAMPLE_CIRCUITBREAKER_RESETTIMEOUT=30000
CLIENTS_SAMPLE_CIRCUITBREAKER_ROLLINGCOUNTTIMEOUT=10000
CLIENTS_SAMPLE_CIRCUITBREAKER_ROLLINGCOUNTBUCKETS=10
CLIENTS_SAMPLE_CIRCUITBREAKER_VOLUMETHRESHOLD=5
```

Or, in a config file (TypeScript):

```typescript
// src/config/environments/local/clients.config.ts
import { registerAs } from "@nestjs/config";

export default registerAs("clients", () => ({
  sample: {
    baseUrl: "http://localhost:4000",
    timeout: 10000,
    circuitBreaker: {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      volumeThreshold: 5
    }
  }
}));
```

> **Tip:** You can override these values per environment (local, staging, production) by placing them in the appropriate
> config file or setting environment variables.

---

For more details, see the [Opossum Circuit Breaker documentation](https://nodeshift.dev/opossum/),
[telemetry](opentelemetry.md) and the
main [README](../README.md).
