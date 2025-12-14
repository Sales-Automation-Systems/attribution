// Domain normalization utilities

// Known multi-part TLDs that need special handling
const MULTI_PART_TLDS = new Set([
  'co.uk',
  'co.nz',
  'co.za',
  'co.jp',
  'co.kr',
  'co.in',
  'co.id',
  'co.il',
  'co.th',
  'com.au',
  'com.br',
  'com.mx',
  'com.sg',
  'com.hk',
  'com.tw',
  'com.ar',
  'com.co',
  'com.my',
  'com.ph',
  'com.vn',
  'com.tr',
  'com.ua',
  'com.pk',
  'com.ng',
  'com.eg',
  'org.uk',
  'org.au',
  'org.nz',
  'net.au',
  'net.nz',
  'gov.uk',
  'gov.au',
  'ac.uk',
  'ac.nz',
  'edu.au',
]);

/**
 * Normalize a domain to its root domain
 * e.g., "sales.acme.com" -> "acme.com"
 * e.g., "www.company.co.uk" -> "company.co.uk"
 */
export function normalizeDomain(domain: string | null): string | null {
  if (!domain) return null;

  // Lowercase and trim
  let d = domain.toLowerCase().trim();

  // Remove any protocol
  d = d.replace(/^https?:\/\//, '');

  // Remove any path or query string
  d = d.split('/')[0].split('?')[0].split('#')[0];

  // Remove www. prefix
  d = d.replace(/^www\./, '');

  // Split into parts
  const parts = d.split('.');

  // Need at least 2 parts
  if (parts.length < 2) {
    return d;
  }

  // Handle multi-part TLDs (co.uk, com.au, etc.)
  if (parts.length > 2) {
    const lastTwo = parts.slice(-2).join('.');
    if (MULTI_PART_TLDS.has(lastTwo)) {
      // Keep last 3 parts: company.co.uk
      return parts.slice(-3).join('.');
    }
  }

  // Standard: keep last 2 parts (company.com)
  return parts.slice(-2).join('.');
}

/**
 * Extract domain from an email address
 * e.g., "john@sales.acme.com" -> "acme.com"
 */
export function extractDomain(email: string | null): string | null {
  if (!email) return null;

  // Basic email validation
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;

  return normalizeDomain(parts[1]);
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if an event is within the 31-day attribution window
 */
export function isWithinAttributionWindow(
  emailSentAt: Date,
  eventTime: Date
): boolean {
  return daysBetween(emailSentAt, eventTime) <= 31;
}

/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format a date for the attribution month (YYYY-MM)
 */
export function formatAttributionMonth(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get the match reason for audit trail
 */
export function getMatchReason(
  eventEmail: string | null,
  eventDomain: string | null,
  matchedEmail: string | null,
  emailSentAt: Date | null,
  eventTime: Date,
  isPersonalDomain: boolean
): string {
  if (!matchedEmail && !emailSentAt) {
    if (isPersonalDomain) {
      return `No match: Domain is a personal email domain`;
    }
    return `No match: No emails found sent to ${eventEmail || eventDomain}`;
  }

  if (!emailSentAt) {
    return `No match: No email sent within 31-day window`;
  }

  const days = daysBetween(emailSentAt, eventTime);

  if (
    eventEmail &&
    matchedEmail &&
    eventEmail.toLowerCase() === matchedEmail.toLowerCase()
  ) {
    return `Direct match: Exact email match (${matchedEmail}), email sent ${days} days before event`;
  }

  return `Company match: Domain match, email sent to ${matchedEmail}, ${days} days before event`;
}

/**
 * Map event type string to EventSource enum
 */
export function mapEventTypeToSource(
  eventType: string
): 'SIGN_UP' | 'MEETING_BOOKED' | 'PAYING_CUSTOMER' | null {
  switch (eventType.toLowerCase()) {
    case 'sign_up':
      return 'SIGN_UP';
    case 'meeting_booked':
      return 'MEETING_BOOKED';
    case 'paying_customer':
      return 'PAYING_CUSTOMER';
    default:
      return null;
  }
}

