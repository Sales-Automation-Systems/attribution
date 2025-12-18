#!/usr/bin/env tsx
/**
 * Database Migration Script
 * Runs SQL migrations against the attribution database
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, '../sql/migrations');

async function runMigrations() {
  const connectionString = process.env.ATTR_DATABASE_URL;

  if (!connectionString) {
    console.error('Error: ATTR_DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to database...');
    await pool.query('SELECT 1');
    console.log('Connected successfully!\n');

    // Get all SQL files sorted by name
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files:\n`);

    for (const file of files) {
      console.log(`Running: ${file}`);

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await pool.query(sql);
        console.log(`  ✓ Success\n`);
      } catch (error) {
        console.error(`  ✗ Error: ${(error as Error).message}\n`);
        // Continue with other migrations even if one fails
      }
    }

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();


