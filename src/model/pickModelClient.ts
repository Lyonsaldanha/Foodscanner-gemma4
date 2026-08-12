import { createMockModelClientForFixture } from "./mockEngine";
import type { ModelClient } from "./types";

// Shared by every screen that needs a ModelClient (processing.tsx, T13.2's
// onboarding gate in app/index.tsx) so there's one place that decides mock
// vs. real, not one copy per screen.
//
// Defaults to the mock so the web preview and existing test/demo flow are
// unaffected — set EXPO_PUBLIC_USE_MOCK_MODEL=false to attempt the real
// react-native-litert-lm-backed client (native build + device only; see
// engine.ts and plan.md T12.1-T12.2). This flag is the only thing that needs
// to change to try the real path.
//
// engine.ts is loaded via a *dynamic* import, not a static one: it pulls in
// react-native-litert-lm, a native-only package whose module-level side
// effects crash Expo's web bundle if evaluated eagerly (confirmed live —
// static import broke the web preview even with the mock branch selected,
// because expo-router bundles a screen's module graph eagerly). A dynamic
// import is only evaluated when this branch actually runs, so the mock
// (default) path never touches it.
export async function pickModelClient(): Promise<ModelClient> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_MODEL === "false") {
    const { realModelClient } = await import("./engine");
    return realModelClient;
  }
  return createMockModelClientForFixture("shortbreadBiscuit");
}
