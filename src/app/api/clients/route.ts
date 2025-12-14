// Clients API
// Get all clients

import { NextResponse } from 'next/server';
import { getAllClientConfigs, getDashboardStats } from '@/db/attribution/queries';

export async function GET() {
  try {
    const clients = await getAllClientConfigs();

    // Get stats for each client
    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const stats = await getDashboardStats(client.id);
        return {
          id: client.id,
          clientId: client.client_id,
          clientName: client.client_name,
          slug: client.slug,
          accessUuid: client.access_uuid,
          revShareRate: client.rev_share_rate,
          createdAt: client.created_at,
          stats: {
            totalAttributed: stats.total_attributed_domains,
            totalPaying: stats.total_paying_customers,
            hardMatches: stats.total_hard_matches,
            softMatches: stats.total_soft_matches,
            pendingDisputes: stats.pending_disputes,
          },
        };
      })
    );

    return NextResponse.json({ clients: clientsWithStats });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients', details: (error as Error).message },
      { status: 500 }
    );
  }
}

