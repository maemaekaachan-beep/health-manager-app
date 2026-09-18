import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL (or POSTGRES_URL) environment variable is not set');
}

export const sql = neon(connectionString);

export const LIST_TABLES = {
  meals: 'meals',
  sleep: 'sleep_entries',
  weight: 'weight_entries',
  steps: 'step_entries',
  bowel: 'bowel_entries',
  'custom-foods': 'custom_foods',
  conditions: 'conditions',
} as const;

export type ListResource = keyof typeof LIST_TABLES;

export function isListResource(value: string): value is ListResource {
  return Object.prototype.hasOwnProperty.call(LIST_TABLES, value);
}

const NO_DATE_RESOURCES = new Set<ListResource>(['custom-foods', 'conditions']);

export function resourceHasDate(resource: ListResource): boolean {
  return !NO_DATE_RESOURCES.has(resource);
}
