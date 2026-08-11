# OpenTelemetry Integration Guide

OpenTelemetry is integrated into this project, how to enable distributed tracing and metrics,
and how to run the application with OpenTelemetry instrumentation.

## Overview

OpenTelemetry provides distributed tracing and metrics collection for your application. This enables you to track
requests as they flow through your services and gain insights into performance and bottlenecks.

## Features

- **Distributed Tracing:** Automatically traces incoming and outgoing requests, including downstream HTTP calls.
- **Metrics Collection:** Collects application and system metrics for observability.
- **Trace Context Propagation:** Ensures that trace context (e.g., `traceparent` header) is propagated to all downstream
  requests for end-to-end visibility.

## How to Enable OpenTelemetry

By default, OpenTelemetry is disabled. To enable it, you need to run the application with the OpenTelemetry bootstrap
file loaded.

### For Development (with ts-node)

```sh
NODE_OPTIONS='--require ts-node/register --require ./src/otel.bootstrap.ts' yarn start:dev
```

### For Production (after build)

```sh
node --require ./dist/otel.bootstrap.js dist/main.js
```

This ensures that the OpenTelemetry instrumentation is loaded before your application starts.

## Trace Context Propagation

- The application is configured to automatically propagate the `traceparent` header on all outgoing HTTP requests.
- This is handled by the HTTP client layer, so you do not need to manually set trace headers in your code.
- This enables distributed tracing across all services that support the W3C Trace Context standard.

## Customization

You can customize the OpenTelemetry setup (e.g., exporters, sampling, resource attributes) by editing
`src/otel.bootstrap.ts`.

---

For more details on distributed tracing and observability, see the [open-telemetry documentation](https://opentelemetry.io/docs/).
