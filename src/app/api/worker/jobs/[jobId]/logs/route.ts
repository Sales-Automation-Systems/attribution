import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const workerUrl = process.env.WORKER_URL;
    
    if (!workerUrl) {
      return NextResponse.json(
        { error: 'WORKER_URL not configured', logs: [] },
        { status: 200 }
      );
    }

    // Get query params
    const searchParams = req.nextUrl.searchParams;
    const since = searchParams.get('since');
    const limit = searchParams.get('limit') || '100';

    let url = `${workerUrl}/job/${jobId}/logs?limit=${limit}`;
    if (since) {
      url += `&since=${encodeURIComponent(since)}`;
    }

    const response = await fetch(url, {
      next: { revalidate: 0 }, // Don't cache
    });

    if (!response.ok) {
      throw new Error(`Worker responded with ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching job logs:', error);
    return NextResponse.json(
      { error: (error as Error).message, logs: [] },
      { status: 200 }
    );
  }
}




