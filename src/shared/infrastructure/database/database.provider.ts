import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigurationPort } from '../../application/ports/outbound/configuration.port';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION_TIMEOUT_MS } from './database.constants';

@Injectable()
export class DatabaseProvider implements OnApplicationShutdown {
  readonly client: ReturnType<typeof drizzle>;
  private readonly logger = new Logger(DatabaseProvider.name);
  private readonly onPoolError = (): void => {
    this.logger.error('Unexpected error on an idle database connection');
  };

  constructor(private readonly config: ConfigurationPort) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }
    let url: URL;
    try {
      url = new URL(connectionString);
    } catch {
      throw new Error('DATABASE_URL must be a PostgreSQL URL');
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
      throw new Error('DATABASE_URL must be a PostgreSQL URL');
    }
    this.client = drizzle({
      connection: {
        connectionString,
        connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
      },
    });
    this.client.$client.on('error', this.onPoolError);
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.$client.end();
    } finally {
      this.client.$client.removeListener('error', this.onPoolError);
    }
  }
}
