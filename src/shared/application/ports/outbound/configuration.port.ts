export abstract class ConfigurationPort {
  abstract get<T>(key: string): T | undefined;
  abstract getOrThrow<T>(key: string): T;
}
