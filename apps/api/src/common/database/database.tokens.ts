import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';

export const DATABASE = Symbol('DATABASE');
export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

export type Database = PostgresJsDatabase<typeof schema>;
