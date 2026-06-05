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

// Comprehensive dictionary of common English first/last names to block personal recording
const COMMON_NAMES = new Set([
  // First Names (Male & Female)
  'john', 'jane', 'micheal', 'michael', 'david', 'sarah', 'james', 'robert', 'william', 
  'thomas', 'emily', 'jessica', 'ashley', 'matthew', 'andrew', 'daniel', 'paul',
  'mark', 'mary', 'patricia', 'jennifer', 'elizabeth', 'linda', 'susan', 'margaret',
  'dorothy', 'lisa', 'nancy', 'karen', 'betty', 'helen', 'sandra', 'donna', 'carol',
  'ruth', 'sharon', 'michelle', 'laura', 'sarah', 'kimberly', 'deborah', 'shirley',
  'barbara', 'richard', 'joseph', 'charles', 'christopher', 'donald', 'george',
  'steven', 'kenneth', 'edward', 'brian', 'ronald', 'timothy', 'jason', 'jeffrey',
  'ryan', 'gary', 'jacob', 'nicholas', 'eric', 'stephen', 'jonathan', 'larry',
  'justin', 'scott', 'brandon', 'frank', 'benjamin', 'gregory', 'samuel', 'raymond',
  'patrick', 'alexander', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose',
  'henry', 'adam', 'douglas', 'nathan', 'peter', 'zachary', 'walter', 'harold',
  'alice', 'bob', 'charlie', 'dave', 'steve', 'tom', 'tim', 'mike', 'sam', 'tony',
  'chris', 'alex', 'lucy', 'luke', 'amy', 'rebecca', 'pamela', 'heather', 'kathleen',
  'anna', 'julia', 'samantha', 'sofia', 'sophia', 'isabella', 'olivia', 'lily',
  'angela', 'melissa', 'brenda', 'stephanie', 'carolyn', 'christine', 'marie', 'janet',
  'catherine', 'ann', 'joyce', 'diane', 'alice', 'julie', 'teresa', 'doris', 'gloria',
  'evelyn', 'jean', 'chery', 'cheryl', 'mildred', 'joan', 'janice', 'kelly', 'nicole',
  'judy', 'theresa', 'beverly', 'denise', 'tammy', 'irene', 'lori', 'rachel', 'marilyn',
  'andrea', 'kathryn', 'louise', 'sara', 'anne', 'jacqueline', 'wanda', 'bonnie',
  'ruby', 'lois', 'tina', 'phyllis', 'norma', 'paula', 'diana', 'annie', 'lillian',
  'robin', 'peggy', 'crystal', 'gladys', 'connie', 'dawn', 'clara', 'bruce', 'billy',
  'bill', 'markus', 'antonio', 'arthur', 'willie', 'brent', 'neil', 'tracey', 'tracy',
  'greg', 'gregory', 'ian', 'nigel', 'phil', 'philip', 'phillip', 'colin', 'brian',
  'marcus', 'alan', 'allen', 'stuart', 'graham', 'simon', 'richard', 'alex', 'alexander',
  'andrew', 'andy', 'liam', 'oliver', 'harry', 'george', 'charlie', 'leo', 'arthur',
  'oscar', 'amelia', 'isla', 'ava', 'mia', 'ivy', 'grace', 'freya', 'claire', 'joanne',
  'gillian', 'nicola', 'fiona', 'kerry', 'sheila', 'gavin', 'stefan', 'rob', 'bobby',
  
  // Last Names
  'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 
  'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson', 
  'taylor', 'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson', 'white', 
  'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson', 'walker', 'young', 
  'allen', 'king', 'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores', 
  'green', 'adams', 'nelson', 'baker', 'hall', 'rivera', 'campbell', 'mitchell', 
  'carter', 'roberts', 'jenkins', 'evans', 'stewart', 'morris', 'rogers', 'murphy',
  'cook', 'morgan', 'bell', 'bailey', 'cooper', 'richardson', 'cox', 'howard', 'ward',
  'tracey', 'davies', 'clarke', 'turner', 'wood', 'harris', 'croft', 'hughes', 'watson',
  'harrison', 'patel', 'marshall', 'gray', 'grey', 'ali', 'begum', 'mason', 'hunt',
  'shaw', 'reid', 'bennett'
]);

// Words indicative of a street name, pub, landmark, or public node to prevent address false positives
const STREET_LANDMARK_WORDS = new Set([
  'st', 'street', 'rd', 'road', 'ave', 'avenue', 'ln', 'lane', 'cl', 'close', 'way', 'dr', 'drive', 
  'pl', 'place', 'junction', 'intersection', 'corner', 'roundabout', 'bypass', 'bridge', 'park', 
  'church', 'school', 'shop', 'store', 'pub', 'bar', 'station', 'centre', 'center', 'square', 
  'parade', 'gardens', 'mews', 'hill', 'view', 'green', 'wood', 'fields', 'common', 'walk', 
  'terrace', 'crescent', 'rise', 'row', 'yard', 'quay', 'wharf', 'dock', 'harbour', 'harbor', 
  'heights', 'highway', 'alley', 'walkway', 'path', 'pharmacy', 'hospital', 'building', 'office', 
  'court', 'driveway', 'gate', 'grove', 'mount', 'orchard', 'ridge', 'valley', 'village', 'garage',
  'police', 'council', 'supermarket', 'mall', 'gym', 'theatre', 'theater', 'library', 'museum',
  'bus', 'rail', 'train', 'metro', 'airport', 'pier', 'junction', 'crossing'
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

  // 5. Check for common names across the entire input, context-aware of street suffixes
  // Strip punctuation but keep apostrophes inside words to support John's or John's Camera
  const normalized = trimmed.toLowerCase().replace(/['’]s\b/g, ''); // strip 's indicator
  const words = normalized.split(/[\s,.-]+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (COMMON_NAMES.has(word)) {
      // Look ahead and behind to check if this name is part of street/landmark names (e.g. "John Street", "William Park")
      const nextWord = i < words.length - 1 ? words[i + 1] : '';
      const prevWord = i > 0 ? words[i - 1] : '';
      
      const isNextStreet = STREET_LANDMARK_WORDS.has(nextWord);
      const isPrevStreet = STREET_LANDMARK_WORDS.has(prevWord);
      
      if (!isNextStreet && !isPrevStreet) {
        return `Potential personal name '${word}' detected. Individual private names must not be recorded in public camera descriptions or names.`;
      }
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
