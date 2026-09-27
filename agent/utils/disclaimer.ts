/**
 * Aurum AI - Mandatory Financial Disclaimer Injector
 * Complies with RULE-012: Every price-related message includes the disclaimer,
 * with no code path that can emit a price without it.
 */

export const MANDATORY_DISCLAIMER_HINDI =
  "Yeh anumaanit keemat hai — sthaniya dukaandaar se alag ho sakti hai. Yeh salaah nahi hai.";

/**
 * Checks if a message text contains price or currency references.
 */
export function containsPriceOrMarketData(text: string): boolean {
  if (!text) return false;
  // Match currency symbols, words, or price patterns
  const pricePatterns = [
    /₹/,
    /INR/i,
    /Rs\.?/i,
    /rupee/i,
    /rupaye/i,
    /rate/i,
    /bhav/i,
    /keemat/i,
    /daam/i,
    /saste/i,
    /mehnga/i,
    /average/i,
    /MA\s*\d+/i,
    /\d+k/i,
    /\d{4,}/, // 4 or more consecutive digits (typical price figures)
  ];
  return pricePatterns.some((pattern) => pattern.test(text));
}

/**
 * Ensures that if text contains any price context, the disclaimer is attached.
 * If force=true, attaches disclaimer unconditionally.
 */
export function ensureDisclaimer(text: string, force: boolean = false): string {
  const trimmed = text.trim();
  const alreadyHasDisclaimer = trimmed.includes("Yeh anumaanit keemat hai") ||
    trimmed.includes("Yeh salaah nahi hai");

  if (alreadyHasDisclaimer) {
    return trimmed;
  }

  if (force || containsPriceOrMarketData(trimmed)) {
    return `${trimmed}\n\n_${MANDATORY_DISCLAIMER_HINDI}_`;
  }

  return trimmed;
}
