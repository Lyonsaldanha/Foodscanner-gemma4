import type { ScanResult } from "../types/scan";

// Simplest possible hand-off from Processing to the not-yet-built Result
// screen (T7.3): a module-level variable, not a route param (a full
// ScanResult — a nested ingredients array plus nutrition/balance — is too
// large/awkward to serialize through a URL) and not a Context provider
// (no other screen needs this shared yet). Swap for something richer only
// if a real need for it shows up later.
let lastScanResult: ScanResult | null = null;

export function setLastScanResult(result: ScanResult): void {
  lastScanResult = result;
}

export function getLastScanResult(): ScanResult | null {
  return lastScanResult;
}
