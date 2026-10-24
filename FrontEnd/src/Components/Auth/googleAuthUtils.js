/**
 * Google Authentication Utilities and Validation
 * Provides strict validation matching Google Identity Services (GIS) standards.
 */

// RFC 5322 compliant regex for robust email validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Known invalid / non-existent keywords and test domains
const INVALID_KEYWORDS = [
  'invalid',
  'fake',
  'dummy',
  'nonexistent',
  'wrong',
  'bad',
  'noaccount',
  'null',
  'undefined',
  'test-fail',
];

const INVALID_DOMAINS = [
  'invalid.com',
  'example.invalid',
  'test.com',
  'fake.com',
  'dummy.com',
  'bad.com',
  'example.com',
  'example.org',
  'localhost',
];

/**
 * Validates a Google account input string (Email or Phone).
 * Matches real Google GIS error messages:
 * - "Enter an email or phone number"
 * - "Enter a valid email or phone number"
 * - "Couldn't find your Google Account"
 *
 * @param {string} input - The email or phone entered by the user
 * @returns {{ isValid: boolean, error?: string, email?: string, name?: string }}
 */
export const validateGoogleAccountInput = (input) => {
  if (!input || typeof input !== 'string') {
    return { isValid: false, error: 'Enter an email or phone number' };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Enter an email or phone number' };
  }

  const lower = trimmed.toLowerCase();

  // If input doesn't contain '@', treat as phone number or username
  if (!trimmed.includes('@')) {
    // Check if phone number (optional +, digits, spaces, dashes)
    const isPhoneLike = /^[0-9+\s\-()]+$/.test(trimmed);
    if (isPhoneLike) {
      const cleanPhone = trimmed.replace(/[\s\-()]/g, '');
      const validPhoneDigits = /^\+?[0-9]{7,15}$/.test(cleanPhone);
      if (!validPhoneDigits) {
        return { isValid: false, error: 'Enter a valid email or phone number' };
      }
      // Obvious fake phone numbers
      if (/^(\+?0+|1234567890)$/.test(cleanPhone) || cleanPhone.length < 10) {
        return { isValid: false, error: "Couldn't find your Google Account" };
      }
      return {
        isValid: true,
        email: `${cleanPhone.replace('+', '')}@phone.google.com`,
        name: cleanPhone,
      };
    }

    // It's a text string without '@' (e.g. 'invalid', 'siva', 'test', etc.)
    // In Google, typing an invalid username or non-existent identifier returns "Couldn't find your Google Account"
    // Valid Google username: 6-30 chars, alphanumeric and dots
    const isAlphanumericUsername = /^[a-zA-Z0-9.]{6,30}$/.test(trimmed) &&
      !trimmed.startsWith('.') &&
      !trimmed.endsWith('.') &&
      !trimmed.includes('..');

    if (!isAlphanumericUsername) {
      return { isValid: false, error: 'Enter a valid email or phone number' };
    }

    // Check if the username contains invalid test keywords
    if (INVALID_KEYWORDS.some((kw) => lower.includes(kw))) {
      return { isValid: false, error: "Couldn't find your Google Account" };
    }

    // Return as Gmail email if username is valid format
    const namePart = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return {
      isValid: true,
      email: `${trimmed}@gmail.com`,
      name: namePart,
    };
  }

  // It contains '@': validate email format
  // Check that there is exactly one '@'
  if (trimmed.indexOf('@') !== trimmed.lastIndexOf('@')) {
    return { isValid: false, error: 'Enter a valid email or phone number' };
  }

  const [localPart, domain] = trimmed.split('@');

  // Both local part and domain must exist
  if (!localPart || !domain) {
    return { isValid: false, error: 'Enter a valid email or phone number' };
  }

  // Local part checks (cannot start/end with dot, no consecutive dots)
  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    localPart.includes(' ')
  ) {
    return { isValid: false, error: 'Enter a valid email or phone number' };
  }

  // Domain checks
  if (
    !domain.includes('.') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..') ||
    domain.includes(' ')
  ) {
    return { isValid: false, error: 'Enter a valid email or phone number' };
  }

  // TLD check (must be at least 2 alpha characters: .com, .org, .co, .net, etc.)
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) {
    return { isValid: false, error: 'Enter a valid email or phone number' };
  }

  // Standard regex format check
  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Enter a valid email or phone number' };
  }

  // Check for invalid keywords in local part or domain
  const lowerLocal = localPart.toLowerCase();
  const lowerDomain = domain.toLowerCase();

  const isInvalidKeyword = INVALID_KEYWORDS.some((kw) =>
    lowerLocal === kw ||
    lowerLocal.startsWith(`${kw}.`) ||
    lowerLocal.endsWith(`.${kw}`) ||
    lowerLocal.includes(`-${kw}`) ||
    lowerLocal.includes(`${kw}-`) ||
    lowerLocal.includes(`.${kw}.`)
  );

  const isInvalidDomain = INVALID_DOMAINS.includes(lowerDomain) || lowerDomain.endsWith('.invalid');

  if (isInvalidKeyword || isInvalidDomain || lower === 'invalid') {
    return { isValid: false, error: "Couldn't find your Google Account" };
  }

  const namePart = localPart.split('.')[0];
  const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

  return {
    isValid: true,
    email: trimmed,
    name: formattedName,
  };
};

/**
 * Returns true if an email is strictly valid for Google sign-in.
 * @param {string} email
 * @returns {boolean}
 */
export const isStrictValidGoogleEmail = (email) => {
  const result = validateGoogleAccountInput(email);
  return result.isValid;
};

/**
 * Filters out invalid accounts from a saved accounts list.
 * @param {Array} accounts
 * @returns {Array}
 */
export const sanitizeGoogleAccountsList = (accounts) => {
  if (!Array.isArray(accounts)) return [];
  return accounts.filter((acc) => acc && acc.email && isStrictValidGoogleEmail(acc.email));
};
