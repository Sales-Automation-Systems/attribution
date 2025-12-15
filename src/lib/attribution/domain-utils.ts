// Domain utilities for attribution matching

const COMPOUND_TLDS = new Set([
  'co.uk', 'co.jp', 'co.nz', 'co.za', 'co.in', 'co.kr',
  'com.au', 'com.br', 'com.mx', 'com.cn', 'com.sg', 'com.hk',
  'org.uk', 'org.au', 'net.au', 'gov.uk', 'ac.uk',
]);

export function normalizeDomain(domain: string | null): string | null {
  if (!domain) return null;
  let d = domain.toLowerCase().trim();
  d = d.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
  if (d.startsWith('www.')) d = d.slice(4);
  
  const parts = d.split('.');
  if (parts.length <= 2) return d;
  
  const lastTwo = parts.slice(-2).join('.');
  if (COMPOUND_TLDS.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export function extractDomain(email: string | null): string | null {
  if (!email) return null;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;
  return normalizeDomain(parts[1]);
}

export function daysBetween(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function formatAttributionMonth(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

import type { EventSource } from '@/db/attribution/types';

export function mapEventTypeToSource(eventType: string): EventSource | null {
  const mapping: Record<string, EventSource> = {
    'sign_up': 'SIGN_UP',
    'meeting_booked': 'MEETING_BOOKED',
    'paying_customer': 'PAYING_CUSTOMER',
  };
  return mapping[eventType] || null;
}

