/**
 * Privacy and PII (Personally Identifiable Information) Scanner Utility.
 * Ensures that no PII is entered into the system.
 */

// Regular expressions to detect common PII patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+44\s?7\d{3}|\b07\d{3})\s?\d{6}\b|(\+44\s?[1-9]\d{1,2}|\b0[1-9]\d{1,2})\s?\d{6,7}\b|\b\d{10,12}\b/;
const TITLE_PREFIX_REGEX = /\b(mr|mrs|ms|miss|dr|prof|sir|lady|lord)\b\.?/i;

// Regex to detect house number + street name (e.g., "12 Main St", "Flat 4, Elm Road")
const HOUSE_STREET_REGEX = /\b(flat|room|unit|house|no\.?)?\s?\d+\s*,?\s*[A-Z][a-zA-Z]+\s+(st|street|rd|road|ave|avenue|ln|lane|cl|close|way|dr|drive|pl|place)\b/i;

// Simple common names dictionary check to reject personal names if they stand alone or in specific fields
const COMMON_NAMES = new Set([
  'john', 'jane', 'micheal', 'david', 'sarah', 'james', 'robert', 'william', 
  'thomas', 'emily', 'jessica', 'ashley', 'matthew', 'andrew', 'daniel', 'paul'
]);

/**
 * Scans a given text string for potential PII.
 * Returns a description of the violation if PII is detected, or null if clean.
 */
export function scanForPII(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  // 1. Check for email patterns
  if (EMAIL_REGEX.test(trimmed)) {
    return "Email address detected. Email addresses are strictly prohibited to protect personal privacy.";
  }

  // 2. Check for phone numbers
  if (PHONE_REGEX.test(trimmed)) {
    return "Phone number detected. Contact numbers are strictly prohibited to protect personal privacy.";
  }

  // 3. Check for specific name titles (Mr, Dr, Prof)
  if (TITLE_PREFIX_REGEX.test(trimmed)) {
    return "Personal name prefix detected (Mr./Mrs./Dr.). Avoid adding specific contact or supervisor names.";
  }

  // 4. Check for residential house numbers with street name
  if (HOUSE_STREET_REGEX.test(trimmed)) {
    return "Specific street address/house number detected. Please use general area descriptions instead of specific house or flat numbers (e.g., 'High Street, near junction X').";
  }

  // 5. Check for standalone common names
  const words = trimmed.toLowerCase().split(/[\s,.-]+/);
  for (const word of words) {
    if (COMMON_NAMES.has(word) && words.length <= 3) {
      return `Potential personal name '${word}' detected. Individual private names must not be recorded.`;
    }
  }

  return null;
}

/**
 * Scans an entire object's string keys for PII.
 */
export function scanObjectForPII(obj: Record<string, any>): string | null {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      const violation = scanForPII(obj[key]);
      if (violation) {
        return `PII violation in field '${key}': ${violation}`;
      }
    }
  }
  return null;
}
