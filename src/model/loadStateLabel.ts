import type { ModelLoadState } from "./types";

// Pulled out of app/index.tsx so all 5 ModelLoadState variants (T4.1) are
// unit-testable directly, rather than only verifiable by driving a live
// screen through states a mock client can't actually produce on its own
// (the mock never reports "downloading"/"loading"/"error" — see
// mockEngine.ts).
export function describeLoadState(state: ModelLoadState): string {
  switch (state.status) {
    case "not_downloaded":
      return "Preparing…";
    case "downloading":
      return `Downloading model… ${Math.round(state.progress * 100)}%`;
    case "loading":
      return "Loading model…";
    case "ready":
      return "Ready to scan.";
    case "error":
      return state.message;
  }
}
