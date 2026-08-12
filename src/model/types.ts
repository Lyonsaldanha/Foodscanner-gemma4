// Output of src/camera/preprocess.ts (T6.1) — resize+normalize happens before
// the model client is ever called, so this seam only needs to describe the
// prepared image, not raw camera bytes.
export interface PreprocessedImage {
  uri: string;
  width: number;
  height: number;
}

export interface ModelGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  image: PreprocessedImage;
  // Optional (T13.3): lets a caller abandon a generate() call early — e.g.
  // Processing screen's Cancel button. See src/model/abortable.ts for what
  // this can and can't actually stop.
  signal?: AbortSignal;
}

// Mirrors the model lifecycle from ingredient-lens-spec.md §7 (first-launch
// download, then load-from-cache on subsequent launches) so a real
// react-native-litert-lm-backed implementation has a state to report through.
export type ModelLoadState =
  | { status: "not_downloaded" }
  | { status: "downloading"; progress: number } // 0-1
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

// The seam every module above it (T4.5 orchestration, and everything that
// depends on it) codes against. One real implementation wraps
// react-native-litert-lm's hook-based API (spec §11.2's `useModel` +
// `model.sendMessage`) behind this plain shape; mockEngine.ts (T4.2) is the
// only implementation actually exercised in this sandbox.
export interface ModelClient {
  getLoadState(): ModelLoadState;
  // Resolves once the model is downloaded, loaded, and ready to run
  // generate() — a no-op if already ready. Rejects on download/load failure.
  ensureReady(): Promise<void>;
  // One inference call: system+user prompt plus the capture image in, raw
  // model text out. Parsing/validation of that text is the parser's job
  // (T4.4), not the client's.
  generate(options: ModelGenerateOptions): Promise<string>;
}
