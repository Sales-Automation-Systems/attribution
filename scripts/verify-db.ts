#!/usr/bin/env tsx
/**
 * Quick script to verify database tables were created
 */

import { Pool } from 'pg';

async function verify() {
  const pool = new Pool({
    connectionString: process.env.ATTR_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Checking tables...\n');
    
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Tables created:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Check personal email domains count
    const domains = await pool.query('SELECT COUNT(*) FROM personal_email_domain');
    console.log(`\nPersonal email domains seeded: ${domains.rows[0].count}`);
    
    console.log('\n✓ Database setup verified successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verify();



