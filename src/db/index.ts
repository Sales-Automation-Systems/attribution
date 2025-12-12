import { Pool } from 'pg';

// Production database - READ ONLY
// DigitalOcean PostgreSQL
export const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Attribution database - READ/WRITE
// Railway PostgreSQL
export const attrPool = new Pool({
  connectionString: process.env.ATTR_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false,
  },
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

  const result = await prodPool.query(sql, params);
  return result.rows as T[];
}

// Helper for attribution database queries (read/write allowed)
export async function attrQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await attrPool.query(sql, params);
  return result.rows as T[];
}

// Test database connections
export async function testConnections(): Promise<{
  production: boolean;
  attribution: boolean;
}> {
  const results = { production: false, attribution: false };

  try {
    await prodPool.query('SELECT 1');
    results.production = true;
  } catch (error) {
    console.error('Production DB connection failed:', error);
  }

  try {
    await attrPool.query('SELECT 1');
    results.attribution = true;
  } catch (error) {
    console.error('Attribution DB connection failed:', error);
  }

  return results;
}

// Graceful shutdown
export async function closePools(): Promise<void> {
  await Promise.all([prodPool.end(), attrPool.end()]);
}

