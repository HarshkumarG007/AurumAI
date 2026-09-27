/**
 * Aurum AI - Telegram MarkdownV2 Formatting Utilities
 * Spec §2: MarkdownV2 requires escaping _ * [ ] ( ) ~ ` > # + - = | { } . !
 */

const MARKDOWN_V2_CHARS = /[_*[\]()~`>#+\-=|{}.!\\]/g;

/**
 * Escapes all reserved Telegram MarkdownV2 special characters.
 */
export function escapeMarkdownV2(text: string): string {
  if (!text) return "";
  return text.replace(MARKDOWN_V2_CHARS, "\\$&");
}

/**
 * Formats a number with Indian currency grouping (e.g. 1,57,084.60).
 */
export function formatIndianCurrency(amount: number): string {
  if (isNaN(amount)) return "0.00";
  const parts = amount.toFixed(2).split(".");
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian numbering: last 3 digits, then groups of 2
  const isNegative = integerPart.startsWith("-");
  if (isNegative) integerPart = integerPart.substring(1);

  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const rest = integerPart.substring(0, integerPart.length - 3);
    const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    integerPart = groupedRest + "," + lastThree;
  }

  const formatted = (isNegative ? "-" : "") + integerPart + "." + decimalPart;
  return `₹${formatted}`;
}
