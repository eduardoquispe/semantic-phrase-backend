import { Logger } from '@nestjs/common';
import { ConfigurationStub } from '../../../../test/fixtures/configuration';
import { Pool } from 'pg';
import { DatabaseProvider } from './database.provider';

describe('Database configuration and lifecycle', () => {
  function createProvider(
    value: string | undefined = 'postgresql://user:password@localhost/db',
  ) {
    const config = new ConfigurationStub();
    jest.spyOn(config, 'get').mockReturnValue(value);
    return new DatabaseProvider(config);
  }

  it.each([
    [undefined, 'DATABASE_URL is required'],
    ['', 'DATABASE_URL is required'],
    ['invalid', 'DATABASE_URL must be a PostgreSQL URL'],
    ['https://user:secret@host/db', 'DATABASE_URL must be a PostgreSQL URL'],
    ['postgresql:///db', 'DATABASE_URL must be a PostgreSQL URL'],
    ['postgresql://user:secret@', 'DATABASE_URL must be a PostgreSQL URL'],
  ])('rejects invalid configuration with a safe error', (value, message) => {
    const config = new ConfigurationStub();
    jest.spyOn(config, 'get').mockReturnValue(value);
    expect(() => new DatabaseProvider(config)).toThrow(new Error(message));
  });

  it.each(['postgres:', 'postgresql:'])(
    'accepts %s URLs and bounds connection waits',
    async (protocol) => {
      const connectionString = `${protocol}//user:password@localhost/db`;
      const provider = createProvider(connectionString);
      expect(provider.client.$client).toBeInstanceOf(Pool);
      expect(provider.client.$client).toEqual(
        expect.objectContaining({
          options: expect.objectContaining({
            connectionString,
            connectionTimeoutMillis: 5000,
          }) as unknown,
        }),
      );
      await provider.onApplicationShutdown();
    },
  );

  it('reuses the client and closes the Drizzle-created pool on shutdown', async () => {
    const provider = createProvider();
    const pool = provider.client.$client;
    const end = jest.spyOn(pool, 'end');
    expect(provider.client).toBe(provider.client);
    expect(pool.listenerCount('error')).toBe(1);
    await provider.onApplicationShutdown();
    expect(end).toHaveBeenCalledTimes(1);
    expect(pool.listenerCount('error')).toBe(0);
  });

  it('handles idle pool errors without logging credentials', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const provider = createProvider();
    try {
      expect(() =>
        provider.client.$client.emit('error', new Error('secret credentials')),
      ).not.toThrow();
      expect(log).toHaveBeenCalledWith(
        'Unexpected error on an idle database connection',
      );
    } finally {
      log.mockRestore();
      await provider.onApplicationShutdown();
    }
  });

  it('removes the error listener even if closing the pool fails', async () => {
    const provider = createProvider();
    const pool = provider.client.$client;
    const failure = new Error('shutdown failed');
    const closeablePool: { end(): Promise<void> } = pool;
    const end = jest.spyOn(closeablePool, 'end').mockRejectedValueOnce(failure);
    try {
      await expect(provider.onApplicationShutdown()).rejects.toBe(failure);
      expect(pool.listenerCount('error')).toBe(0);
    } finally {
      end.mockRestore();
      await pool.end();
    }
  });
});
