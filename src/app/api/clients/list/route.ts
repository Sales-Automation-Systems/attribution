import { NextResponse } from 'next/server';
import { attrQuery } from '@/db';

export async function GET() {
  try {
    const clients = await attrQuery<{ client_id: string; client_name: string }>(`
      SELECT client_id, client_name 
      FROM client_config 
      ORDER BY client_name
    `);
    
    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: (error as Error).message, clients: [] },
      { status: 500 }
    );
  }
}


