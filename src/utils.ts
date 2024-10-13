import { encodeBase32LowerCase } from "@oslojs/encoding";

// Note: Breaking
// - Uses host instead of hostname
// - `allowedDomains` only accepts domains instead of URLs
export function verifyRequestOrigin(
  origin: string,
  allowedDomains: string[]
): boolean {
  if (allowedDomains.length === 0) {
    return false;
  }
  const originHost = parseURL(origin)?.host ?? null;
  if (originHost === null) {
    return false;
  }
  for (const domain of allowedDomains) {
    if (originHost === domain) {
      return true;
    }
  }
  return false;
}

function parseURL(url: URL | string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function generateIdFromEntropySize(size: number): string {
  if (size % 5 !== 0) {
    throw new TypeError("Argument 'size' must be a multiple of 5");
  }
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCase(bytes);
}
