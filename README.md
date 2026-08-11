# Catalyst NestJS

A robust, scalable, and production-ready NestJS boilerplate for building enterprise-grade, multi-tenant applications.
This template is designed to demonstrate best practices for modular architecture, transactional and multi-tenant data
management, safe migrations, advanced logging, and operational endpoints for cloud-native deployments.

## What This Project Demonstrates

- **Multi-Tenancy:**
    - Dynamic schema-based multi-tenant support using TypeORM and PostgreSQL.
    - Safe, parallel migration execution with advisory locking to prevent race conditions.
    - Tenant context propagation for request isolation and transactional integrity.

- **Transactional Operations:**
    - Declarative transactional decorators and interceptors for automatic transaction management.
    - Ensures data consistency and rollback on errors across tenant boundaries.
    - See [Transactions](docs/transaction.md) for details and instructions on how to run with transaction.

- **Operational Endpoints (Actuator):**
    - Health, readiness, liveness, metrics, and info endpoints for monitoring and orchestration.
    - Info endpoint exposes UTC time and deployed commit hash for traceability.

- **Logging:**
    - Integrated Pino logger with context support (MDC-like), file/class-based logging, and sensitive data redaction.
    - Configurable log levels and formats for development and production.

- **Error Handling & Validation:**
    - Centralized error handling for consistent API responses.
    - Request validation using class-validator and class-transformer.

- **Environment & Configuration:**
    - Spring Boot-style configuration system with environment-specific config files and precedence rules.
    - Configuration sources: base config files → environment-specific configs → environment variables (highest
      precedence).
    - Environment-specific folders: `src/config/environments/{NODE_ENV}/` for staging, production, local overrides.
    - Type-safe configuration access through @nestjs/config with automatic config loading based on NODE_ENV.
    - Supports multiple config types (database, logging, app) with easy extensibility for new configurations.
    - Reduces environment variable complexity by handling most configuration through environment-specific files,
      reserving environment variables primarily for secrets and deployment-specific overrides.

- **Testing & CI/CD:**
    - Pre-configured Jest for unit, integration, and e2e tests.
    - Sample GitHub Actions workflow for CI/CD.

- **Containerization:**
    - Production-ready Dockerfile with multi-stage build, healthcheck, commit hash injection, and non-root user.
    - .dockerignore for efficient builds.

- **Open Telemetry Support:**
    - Basic OpenTelemetry setup for distributed tracing and metrics collection.
    - Trace context propagation for downstream requests.
    - See [OpenTelemetry Integration Guide](./docs/opentelemetry.md) for details and instructions on how to run with
      OpenTelemetry.

- **Code Quality:**
    - ESLint and Prettier configurations for a consistent code style.

## How to Build, Run, and Test

### Build Locally

```sh
yarn install --frozen-lockfile
yarn build
```

### Run Locally

```sh
yarn start:local # For local development
yarn start:prod     # For production
```

### Run Tests

```sh
yarn test           # Unit tests
yarn test:e2e       # End-to-end tests
```

### Run Migrations

- Migrations are run automatically on bootstrap for all tenant schemas.
- Safe for parallel execution (advisory lock).

### Build and Run as Docker Container

```sh
docker build --build-arg COMMIT_HASH=$(git rev-parse HEAD) -t catalyst-nestjs .
docker run  -e NODE_ENV="staging" -p 3000:3000 catalyst-nestjs
```

### Operational Endpoints

- `/actuator/health` — Multi-tenant database health
- `/actuator/readiness` — Readiness probe (all datasources connected)
- `/actuator/liveness` — Liveness probe
- `/actuator/info` — UTC time and deployed commit hash

### Code Quality: Format and Lint

To keep your codebase clean and consistent, use the following commands:

```sh
yarn format   # Automatically format your code using Prettier
yarn lint     # Run ESLint to check for code quality issues
```

### Environment Setup

- Copy `.env.example` to `.env` and update required environment variables for your local setup.

## Configuration System

This project uses a Spring Boot-inspired configuration system with environment-specific overrides and clear precedence
rules.

### Key Features

- **Environment-specific config files**: `src/config/environments/{NODE_ENV}/` for staging, production, local overrides
- **Clear precedence**: Environment variables → environment-specific configs → base config files
- **Reduced complexity**: Most configuration handled through files, environment variables reserved for secrets
- **Type-safe access**: Full TypeScript support through @nestjs/config

### Quick Start

1. **Base config**: Create `src/config/{configName}.config.ts`
2. **Register**: Add `loadEnvConfig('configName')` to `src/shared/shared.module.ts`
3. **Environment overrides**: Create `src/config/environments/production/{configName}.config.ts` as needed
4. **Access**: Use `ConfigService` in your code

**📖 For detailed usage, examples, and migration guide, see [Configuration Documentation](./docs/configuration.md)**

## Client Class & Trace Header Propagation

For guidance on creating a client class for downstream requests and how trace headers (traceparent) are automatically
injected for distributed tracing, see [docs/downstream-client.md](./docs/downstream-client.md).


> For more details on architecture, migration safety, multi-tenancy, and operational best practices, see the inline code
> comments and documentation in the `/docs` folder.
