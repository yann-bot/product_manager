import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/**
 * Client Drizzle partagé par toute l'application.
 * À injecter dans les adaptateurs outbound.
 */
export const db = drizzle(process.env.DATABASE_URL!, { schema });

export type DB = typeof db;
