import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// GET all clients with their settings
export async function GET() {
  try {
    const clients = await attrQuery<{
      id: string;
      client_id: string;
      client_name: string;
      slug: string;
      rev_share_rate: number;
      sign_ups_mode: string;
      meetings_mode: string;
      paying_mode: string;
      attribution_window_days: number;
      soft_match_enabled: boolean;
      exclude_personal_domains: boolean;
      last_processed_at: Date | null;
    }>(`
      SELECT id, client_id, client_name, slug, rev_share_rate,
             sign_ups_mode, meetings_mode, paying_mode,
             attribution_window_days, soft_match_enabled, exclude_personal_domains,
             last_processed_at
      FROM client_config
      ORDER BY client_name
    `);

    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching client settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client settings' },
      { status: 500 }
    );
  }
}

// PATCH update a single client's settings
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientId,
      rev_share_rate,
      sign_ups_mode,
      meetings_mode,
      paying_mode,
      attribution_window_days,
      soft_match_enabled,
      exclude_personal_domains,
    } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    // Validate mode values
    const validModes = ['per_event', 'per_domain'];
    if (sign_ups_mode && !validModes.includes(sign_ups_mode)) {
      return NextResponse.json(
        { error: 'Invalid sign_ups_mode. Must be per_event or per_domain' },
        { status: 400 }
      );
    }
    if (meetings_mode && !validModes.includes(meetings_mode)) {
      return NextResponse.json(
        { error: 'Invalid meetings_mode. Must be per_event or per_domain' },
        { status: 400 }
      );
    }
    if (paying_mode && !validModes.includes(paying_mode)) {
      return NextResponse.json(
        { error: 'Invalid paying_mode. Must be per_event or per_domain' },
        { status: 400 }
      );
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (rev_share_rate !== undefined) {
      updates.push(`rev_share_rate = $${paramIndex++}`);
      values.push(rev_share_rate);
    }
    if (sign_ups_mode !== undefined) {
      updates.push(`sign_ups_mode = $${paramIndex++}`);
      values.push(sign_ups_mode);
    }
    if (meetings_mode !== undefined) {
      updates.push(`meetings_mode = $${paramIndex++}`);
      values.push(meetings_mode);
    }
    if (paying_mode !== undefined) {
      updates.push(`paying_mode = $${paramIndex++}`);
      values.push(paying_mode);
    }
    if (attribution_window_days !== undefined) {
      updates.push(`attribution_window_days = $${paramIndex++}`);
      values.push(attribution_window_days);
    }
    if (soft_match_enabled !== undefined) {
      updates.push(`soft_match_enabled = $${paramIndex++}`);
      values.push(soft_match_enabled);
    }
    if (exclude_personal_domains !== undefined) {
      updates.push(`exclude_personal_domains = $${paramIndex++}`);
      values.push(exclude_personal_domains);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No settings provided to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');
    values.push(clientId);

    const query = `
      UPDATE client_config
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await attrQuery(query, values);

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating client settings:', error);
    return NextResponse.json(
      { error: 'Failed to update client settings' },
      { status: 500 }
    );
  }
}

