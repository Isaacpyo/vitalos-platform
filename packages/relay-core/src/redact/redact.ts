/**
 * Personal-data redaction before every model call (section 6.2 step 4, ADR-032). The original
 * text is stored; the model sees only the redacted copy (`messages.body_redacted`).
 *
 * Order matters: structured identifiers with checksums (IBAN, card, NHS) are removed before the
 * looser phone pattern can claim their digits.
 */

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g;
const SORT_ACCOUNT =
  /\b\d{2}[- ]\d{2}[- ]\d{2}[ ,;:]+(?:a\/?c|account|acc(?:ount)? no\.?)?[ :]*\d{8}\b/gi;
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;
const NHS = /\b\d{3}[ -]?\d{3}[ -]?\d{4}\b/g;
const NI =
  /\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z] ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b/gi;
const POSTCODE = /\b(?:GIR ?0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2})\b/gi;
const PHONE =
  /(?:(?<![\w])\+\d{1,3}[ .-]?(?:\(0\)[ .-]?)?\(?|(?<![\w])\(?0)\d{2,5}\)?(?:[ .-]?\d{2,4}){2,3}(?![\w])/g;

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

/** NHS number: 10 digits, modulus 11 check digit. */
export function nhsValid(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  const check = 11 - (sum % 11);
  const expected = check === 11 ? 0 : check;
  return expected !== 10 && expected === Number(digits[9]);
}

/** IBAN mod-97 check. */
export function ibanValid(value: string): boolean {
  const iban = value.replace(/ /g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

const digitsOf = (s: string) => s.replace(/\D/g, "");

export function redact(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(IBAN, (m) => (ibanValid(m) ? "[bank]" : m))
    .replace(SORT_ACCOUNT, "[bank]")
    .replace(CARD, (m) => (luhnValid(digitsOf(m)) ? "[card]" : m))
    .replace(NHS, (m) => (nhsValid(digitsOf(m)) ? "[nhs-number]" : m))
    .replace(NI, "[ni-number]")
    .replace(POSTCODE, "[postcode]")
    .replace(PHONE, (m) => (digitsOf(m).length >= 9 ? "[phone]" : m));
}

/** True when redaction changed the text (used for logging counts only, never content). */
export const containsPersonalData = (text: string) => redact(text) !== text;
