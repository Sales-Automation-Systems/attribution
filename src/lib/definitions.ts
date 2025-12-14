/**
 * Contract Definitions Dictionary
 * 
 * Terms from the Master Consulting Services Agreement (Schedule B)
 * and UI-specific terms with their definitions.
 * 
 * Used by DefinitionTooltip component to show consistent definitions
 * throughout the application.
 */

export type DefinitionKey = keyof typeof DEFINITIONS;

/**
 * Contract-Defined Terms (Schedule B)
 */
export const CONTRACT_DEFINITIONS = {
  attributed: {
    term: 'Attributed',
    definition: "A lead is deemed 'Attributed' if ANY Success Metric occurs within 31 days after we send an outbound email to such lead.",
    source: 'Schedule B, Section 3',
  },
  attributionWindow: {
    term: 'Attribution Window',
    definition: '31 days after an outbound email is sent.',
    source: 'Schedule B, Section 3',
  },
  positiveReply: {
    term: 'Positive Reply',
    definition: 'A direct response from a prospect expressing interest, including affirmative responses, requests for information, meeting requests, or referrals to other decision-makers.',
    source: 'Schedule B, Section 2.1',
  },
  websiteSignUp: {
    term: 'Website Sign-Up',
    definition: 'A form submission or registration on your website by a lead we contacted.',
    source: 'Schedule B, Section 2.2',
  },
  meetingBooked: {
    term: 'Meeting Booked',
    definition: 'A scheduled appointment, demonstration, or sales call arranged through your calendar system.',
    source: 'Schedule B, Section 2.3',
  },
  payingCustomer: {
    term: 'Paying Customer',
    definition: 'Actual closed revenue from Attributed leads.',
    source: 'Schedule B, Section 2.4',
  },
  revenueGenerated: {
    term: 'Revenue Generated',
    definition: 'Actual closed revenue from Attributed leads as reported by Client.',
    source: 'Schedule B, Section 2.4',
  },
  successMetric: {
    term: 'Success Metric',
    definition: 'Any performance-based event: Positive Reply, Website Sign-Up, Meeting Booked, or Revenue Generated.',
    source: 'Schedule B, Section 1.4',
  },
  dispute: {
    term: 'Dispute',
    definition: 'Per Section 4.5, disputes must be submitted within 30 days of invoice, detailing grounds and including supporting evidence.',
    source: 'Section 4.5',
  },
} as const;

/**
 * UI-Specific Terms (Not in Contract)
 */
export const UI_DEFINITIONS = {
  outsideWindow: {
    term: 'Outside Window',
    definition: 'This lead was emailed, but the Success Metric occurred more than 31 days after the email. Not billable unless you manually attribute it.',
    source: null,
  },
  unattributed: {
    term: 'Unattributed',
    definition: 'No matching email record was found for this lead. Not billable unless you manually attribute it.',
    source: null,
  },
  hardMatch: {
    term: 'Hard Match',
    definition: 'The exact email address we contacted matches the event record. High confidence.',
    source: null,
  },
  softMatch: {
    term: 'Soft Match',
    definition: 'The email domain matches, but not the exact email address. Lower confidence.',
    source: null,
  },
  focusView: {
    term: 'Focus View',
    definition: 'Filter to show only Hard Match accounts for high-confidence attribution.',
    source: null,
  },
  promote: {
    term: 'Attribute',
    definition: 'Add this event to your billable attribution. It will be included in your revenue share calculation.',
    source: null,
  },
  clientPromoted: {
    term: 'Client-Attributed',
    definition: 'You manually added this to attribution. Billable at your revenue share rate.',
    source: null,
  },
  disputed: {
    term: 'Disputed',
    definition: 'You have disputed this attribution. Pending review by our team.',
    source: null,
  },
  emailsSent: {
    term: 'Emails Sent',
    definition: 'Total outbound emails sent by our team on your behalf.',
    source: null,
  },
  ours: {
    term: 'Ours',
    definition: 'Events attributed to our outreach within the 31-day Attribution Window.',
    source: null,
  },
  days: {
    term: 'Days',
    definition: 'Number of days between the first email we sent and the Success Metric event.',
    source: null,
  },
  accounts: {
    term: 'Accounts',
    definition: 'Unique company domains that have had at least one Success Metric event.',
    source: null,
  },
} as const;

/**
 * Combined definitions dictionary
 */
export const DEFINITIONS = {
  ...CONTRACT_DEFINITIONS,
  ...UI_DEFINITIONS,
} as const;

/**
 * Helper to get a definition by key
 */
export function getDefinition(key: DefinitionKey) {
  return DEFINITIONS[key];
}

/**
 * Helper to format definition with source citation
 */
export function formatDefinitionWithSource(key: DefinitionKey): string {
  const def = DEFINITIONS[key];
  if (def.source) {
    return `${def.definition} (${def.source})`;
  }
  return def.definition;
}

/**
 * Check if a definition is from the contract
 */
export function isContractDefinition(key: DefinitionKey): boolean {
  return key in CONTRACT_DEFINITIONS;
}

