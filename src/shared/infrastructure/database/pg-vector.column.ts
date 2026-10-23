import { customType } from 'drizzle-orm/pg-core';

export const pgVector = customType<{
  data: string;
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 384})`;
  },
});
