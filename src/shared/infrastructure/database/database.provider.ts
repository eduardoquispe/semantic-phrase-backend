import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';

@Injectable()
export class DatabaseProvider implements OnApplicationShutdown {
  readonly client: ReturnType<typeof drizzle>;
  private readonly logger = new Logger(DatabaseProvider.name);
  private readonly onPoolError = (): void => {
    this.logger.error('Unexpected error on an idle database connection');
  };

  constructor(config: ConfigService) {
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
      connection: { connectionString, connectionTimeoutMillis: 5000 },
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
