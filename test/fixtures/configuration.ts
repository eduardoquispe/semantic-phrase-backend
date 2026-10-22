import { ConfigurationPort } from '../../src/shared/application/ports/outbound/configuration.port';

export class ConfigurationStub extends ConfigurationPort {
  constructor(private readonly values: Record<string, unknown> = {}) {
    super();
  }

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }

  getOrThrow<T>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new TypeError(`Configuration key "${key}" does not exist`);
    }
    return value;
  }
}
