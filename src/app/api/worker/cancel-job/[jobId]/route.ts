import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = process.env.WORKER_URL || 'https://attribution-worker-production.up.railway.app';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  
  try {
    const response = await fetch(`${WORKER_URL}/cancel-job/${jobId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to cancel job' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      { error: 'Failed to connect to worker' },
      { status: 500 }
    );
  }
}


