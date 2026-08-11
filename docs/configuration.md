# Configuration System

This project uses a Spring Boot-inspired configuration system with environment-specific overrides and clear precedence
rules.

## Configuration Structure

```
src/config/
├── environments/
│   ├── local/
│   │   ├── database.config.ts    # Local development overrides
│   │   └── logging.config.ts     # Local logging settings
│   ├── staging/
│   │   └── database.config.ts    # Staging-specific database config
│   └── production/
│       ├── database.config.ts    # Production database settings
│       └── logging.config.ts     # Production logging config
├── database.config.ts            # Base database configuration
└── logging.config.ts             # Base logging configuration
```

## Configuration Precedence (Highest to Lowest)

1. **Environment Variables** (`.env` file or system env vars) - Highest precedence
2. **Environment-specific config files** (`src/config/environments/{NODE_ENV}/`)
3. **Base config files** (`src/config/`) - Fallback defaults

## Benefits

- **Reduces environment variable complexity** by handling most configuration through environment-specific files
- **Reserves environment variables primarily for secrets** and deployment-specific overrides
- **Type-safe configuration access** through @nestjs/config with automatic config loading based on NODE_ENV
- **Easy extensibility** for new configurations with clear file organization

## How to Use

### 1. Adding New Configuration Types

Create a base configuration file:

```typescript
// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'catalyst-nestjs',
  port: parseInt(process.env.PORT ?? '3000', 10),
  timeout: parseInt(process.env.APP_TIMEOUT ?? '30000', 10),
}));
```

**Then add it to the configuration loader in the SharedModule:**

```typescript
// In src/shared/shared.module.ts
ConfigModule.forRoot({
  load: [
    loadEnvConfig('database'),
    loadEnvConfig('logging'),
    loadEnvConfig('app')  // <- Add your new config here
  ],
  isGlobal: true,
}),
```

### 2. Environment-Specific Overrides

Create environment-specific configs to override defaults:

```typescript
// src/config/environments/production/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'catalyst-nestjs-prod',
  port: parseInt(process.env.PORT ?? '8080', 10),      // Different port for prod
  timeout: parseInt(process.env.APP_TIMEOUT ?? '60000', 10), // Longer timeout
  enableMetrics: true,  // Production-only feature
}));
```

**Configuration File Locations:**

- **Base configs**: `src/config/{configName}.config.ts`
- **Local overrides**: `src/config/environments/local/{configName}.config.ts`
- **Staging overrides**: `src/config/environments/staging/{configName}.config.ts`
- **Production overrides**: `src/config/environments/production/{configName}.config.ts`
- **Register configs**: `src/shared/shared.module.ts` (in the `load` array)

### 3. Accessing Configuration in Code

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyService {
  constructor(private configService: ConfigService) {
  }

  someMethod() {
    // Get specific config values
    const dbHost = this.configService.get<string>('database.databases.serhafen-us.host');
    const logLevel = this.configService.get<string>('logging.level');
    const appPort = this.configService.get<number>('app.port');

    // Get entire config namespaces
    const databaseConfig = this.configService.get('database');
    const loggingConfig = this.configService.get('logging');
  }
}
```

### 4. Setting Up Different Environments

**Local Development:**

- Set `NODE_ENV=local` (or leave unset, defaults to 'development')
- Create `src/config/environments/local/` folder with overrides
- Use `.env` file for local environment variables

**Staging:**

- Set `NODE_ENV=staging`
- Create `src/config/environments/staging/` folder with staging-specific configs
- Override with staging environment variables as needed

**Production:**

- Set `NODE_ENV=production`
- Create `src/config/environments/production/` folder with production configs
- Use secure environment variable injection (K8s secrets, Docker secrets, etc.)

## Examples

### Example 1: Different Database Hosts per Environment

```typescript
// Base config (src/config/database.config.ts) - for development
host: process.env.DB_HOST ?? 'localhost'

// Staging override (src/config/environments/staging/database.config.ts)
host: process.env.DB_HOST ?? 'staging-db.company.com'

// Production override (src/config/environments/production/database.config.ts)
host: process.env.DB_HOST ?? 'prod-db.company.com'
```

### Example 2: Different Log Levels per Environment

```typescript
// Base config - debug level for development
level: process.env.LOG_LEVEL ?? 'debug'

// Production override - warn level, structured logging
level: process.env.LOG_LEVEL ?? 'warn'
format: process.env.LOG_FORMAT ?? 'json'
```

### Example 3: Secrets vs Configuration Files

**Use environment variables for secrets:**

```bash
# In production deployment
DB_PASSWORD=secret-password
API_KEY=secret-api-key
JWT_SECRET=jwt-secret
```

**Use config files for everything else:**

```typescript
// src/config/environments/production/database.config.ts
host: process.env.DB_HOST ?? 'prod-database-cluster.company.com',
port: parseInt(process.env.DB_PORT ?? '5432', 10),
maxConnections: 50,
ssl:true, 
```

The system automatically loads the right configuration based on your `NODE_ENV`, with environment variables always
taking the highest precedence for deployment flexibility.
