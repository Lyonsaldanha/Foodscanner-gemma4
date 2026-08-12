import { describeLoadState } from "./loadStateLabel";
import type { ModelLoadState } from "./types";

describe("describeLoadState — covers every ModelLoadState variant distinctly", () => {
  const cases: [ModelLoadState, string][] = [
    [{ status: "not_downloaded" }, "Preparing…"],
    [{ status: "downloading", progress: 0 }, "Downloading model… 0%"],
    [{ status: "downloading", progress: 0.42 }, "Downloading model… 42%"],
    [{ status: "downloading", progress: 1 }, "Downloading model… 100%"],
    [{ status: "loading" }, "Loading model…"],
    [{ status: "ready" }, "Ready to scan."],
    [{ status: "error", message: "Not enough memory to load the model (critical): free up memory." }, "Not enough memory to load the model (critical): free up memory."],
  ];

  it.each(cases)("renders %j as %j", (state, expected) => {
    expect(describeLoadState(state)).toBe(expected);
  });

  it("produces a distinct string for every status, so each is visually distinguishable", () => {
    const labels = cases.map(([state]) => describeLoadState(state));
    expect(new Set(labels).size).toBe(labels.length);
  });
});
