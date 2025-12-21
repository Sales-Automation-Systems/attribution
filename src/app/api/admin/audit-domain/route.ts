import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, domain } = body;

    if (!clientId || !domain) {
      return NextResponse.json(
        { error: 'clientId and domain are required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${WORKER_URL}/audit-domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, domain }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Audit failed:', error);
    return NextResponse.json(
      { error: 'Failed to audit domain', details: (error as Error).message },
      { status: 500 }
    );
  }
}




