import { ConfigService } from '@nestjs/config';
import { NestConfigurationAdapter } from './nest-configuration.adapter';

describe('NestConfigurationAdapter', () => {
  const config = new ConfigService({ TEXT: 'value', NUMBER: 0 });
  const adapter = new NestConfigurationAdapter(config);

  afterEach(() => jest.restoreAllMocks());

  it('delegates optional reads without converting values', () => {
    const get = jest.spyOn(config, 'get');
    expect(adapter.get<string>('TEXT')).toBe('value');
    expect(adapter.get<number>('NUMBER')).toBe(0);
    expect(
      adapter.get<string>('ABSENT_CONFIGURATION_TEST_KEY'),
    ).toBeUndefined();
    expect(get).toHaveBeenCalledWith('TEXT');
  });

  it('delegates required reads and preserves configuration errors', () => {
    const failure = new TypeError('missing configuration');
    const getOrThrow = jest.spyOn(config, 'getOrThrow');
    expect(adapter.getOrThrow<string>('TEXT')).toBe('value');
    expect(getOrThrow).toHaveBeenCalledWith('TEXT');
    getOrThrow.mockImplementationOnce(() => {
      throw failure;
    });
    expect(() => adapter.getOrThrow<string>('MISSING')).toThrow(failure);
  });
});
