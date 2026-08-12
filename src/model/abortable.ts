// Shared by mockEngine.ts and engine.ts's generate() so a
// ModelGenerateOptions.signal firing makes the *promise* our app is
// awaiting settle immediately, instead of only being noticed after the
// underlying work finishes on its own.
export function createAbortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

// Races `promise` against `signal` firing. If the signal is already aborted,
// rejects immediately without ever awaiting `promise`. Does NOT cancel the
// underlying work — that's only possible if `promise`'s own producer checks
// the signal itself (mockEngine.ts does; engine.ts can't, since
// react-native-litert-lm has no cancellation API to call into — see
// engine.ts's generate() for what that means in practice).
export function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}
