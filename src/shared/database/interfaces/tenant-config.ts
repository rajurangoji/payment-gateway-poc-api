export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  schema: string;
  database: string;
  isActive: boolean;
  connectionPoolConfig?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
}
