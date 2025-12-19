import { NextResponse } from 'next/server';
import { attrQuery } from '@/db';

export async function GET() {
  try {
    // Get column info for reconciliation_period
    const periodColumns = await attrQuery(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reconciliation_period'
      ORDER BY ordinal_position
    `);

    // Get column info for reconciliation_line_item
    const lineItemColumns = await attrQuery(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reconciliation_line_item'
      ORDER BY ordinal_position
    `);

    // Get existing indexes on both tables
    const indexes = await attrQuery(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE tablename IN ('reconciliation_period', 'reconciliation_line_item')
      ORDER BY tablename, indexname
    `);

    return NextResponse.json({
      reconciliation_period: periodColumns,
      reconciliation_line_item: lineItemColumns,
      indexes,
    });
  } catch (error) {
    console.error('Error querying schema:', error);
    return NextResponse.json(
      { error: 'Failed to query schema', details: (error as Error).message },
      { status: 500 }
    );
  }
}



