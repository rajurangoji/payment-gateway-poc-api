import { existsSync } from 'fs';
import { join } from 'path';

/* eslint-disable */
export function loadEnvConfig(configName: string): any {
  const environment = process.env.NODE_ENV ?? 'local';
  const envConfigPath = join(
    // root path
    __dirname,
    '..',
    '..',
    'config',
    'environments',
    environment,
    `${configName}.config`,
  );

  // Try environment-specific config first
  if (existsSync(`${envConfigPath}.ts`) || existsSync(`${envConfigPath}.js`)) {
    try {
      const envConfig = require(envConfigPath);
      console.log(
        `✅ Loaded: src/config/environments/${environment}/${configName}.config.ts`,
      );
      return envConfig.default;
    } catch (error) {
      console.warn(`❌ Failed to load environment config: ${error.message}`);
    }
  }

  // Fall back to base config
  try {
    const baseConfig = require(join(__dirname, '..', '..', 'config', `${configName}.config`));
    console.log(
      `✅ Loaded: src/config/${configName}.config.ts (no environment override)`,
    );
    return baseConfig.default;
  } catch (error) {
    throw new Error(`Config not found: ${configName}.config.ts`);
  }
}
