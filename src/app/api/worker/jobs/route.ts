import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const workerUrl = process.env.WORKER_URL;
    
    if (!workerUrl) {
      return NextResponse.json(
        { error: 'WORKER_URL not configured', jobs: [] },
        { status: 200 }
      );
    }

    const response = await fetch(`${workerUrl}/jobs`, {
      next: { revalidate: 0 }, // Don't cache
    });

    if (!response.ok) {
      throw new Error(`Worker responded with ${response.status}`);
    }

    const jobs = await response.json();
    
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Error fetching worker jobs:', error);
    return NextResponse.json(
      { error: (error as Error).message, jobs: [] },
      { status: 200 }
    );
  }
}

