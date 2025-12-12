import { Pool } from 'pg';

// Serverless-optimized pool settings
// Vercel serverless functions have cold starts and short lifecycles
const poolConfig = {
  max: 1, // Single connection per serverless instance
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 30000, // Increased for cold starts
  ssl: {
    rejectUnauthorized: false, // Required for managed databases
  },
};

// Production database - READ ONLY
// DigitalOcean PostgreSQL
export const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ...poolConfig,
});

// Attribution database - READ/WRITE
// Railway PostgreSQL
export const attrPool = new Pool({
  connectionString: process.env.ATTR_DATABASE_URL,
  ...poolConfig,
});

// Helper to ensure production pool is NEVER used for writes
export async function prodQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  // Safety check: block any write operations
  const normalized = sql.trim().toUpperCase();
  if (
    normalized.startsWith('INSERT') ||
    normalized.startsWith('UPDATE') ||
    normalized.startsWith('DELETE') ||
    normalized.startsWith('DROP') ||
    normalized.startsWith('CREATE') ||
    normalized.startsWith('ALTER') ||
    normalized.startsWith('TRUNCATE')
  ) {
    throw new Error('WRITE OPERATIONS ARE NOT ALLOWED ON PRODUCTION DATABASE');
  }

  try {
    const result = await prodPool.query(sql, params);
    return result.rows as T[];
  } catch (error) {
    console.error('Production DB query failed:', error);
    throw error;
  }
}

// Helper for attribution database queries (read/write allowed)
export async function attrQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  try {
    const result = await attrPool.query(sql, params);
    return result.rows as T[];
  } catch (error) {
    console.error('Attribution DB query failed:', error);
    throw error;
  }
}

// Test database connections
export async function testConnections(): Promise<{
  production: boolean;
  attribution: boolean;
  productionError?: string;
  attributionError?: string;
}> {
  const results: {
    production: boolean;
    attribution: boolean;
    productionError?: string;
    attributionError?: string;
  } = { production: false, attribution: false };

  try {
    await prodPool.query('SELECT 1');
    results.production = true;
  } catch (error) {
    console.error('Production DB connection failed:', error);
    results.productionError = (error as Error).message;
  }

  try {
    await attrPool.query('SELECT 1');
    results.attribution = true;
  } catch (error) {
    console.error('Attribution DB connection failed:', error);
    results.attributionError = (error as Error).message;
  }

  return results;
}

// Graceful shutdown
export async function closePools(): Promise<void> {
  await Promise.all([prodPool.end(), attrPool.end()]);
}
