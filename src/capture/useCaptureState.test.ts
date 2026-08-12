import { act, renderHook } from "@testing-library/react-native";
import { useCaptureState } from "./useCaptureState";

describe("useCaptureState — the 4 user paths", () => {
  it("ingredients-only: capture fills the ingredients slot and unblocks Analyze", async () => {
    const { result } = await renderHook(() => useCaptureState());
    expect(result.current.activeTarget).toBe("ingredients");
    expect(result.current.canAnalyze).toBe(false);

    await act(() => result.current.capturePhoto("file://ingredients.jpg"));

    expect(result.current.slots.ingredients?.uri).toBe("file://ingredients.jpg");
    expect(result.current.slots.nutrition).toBeNull();
    expect(result.current.canAnalyze).toBe(true);
  });

  it("nutrition-only: toggling the active target then capturing fills only nutrition", async () => {
    const { result } = await renderHook(() => useCaptureState());

    await act(() => result.current.setActiveTarget("nutrition"));
    expect(result.current.activeTarget).toBe("nutrition");

    await act(() => result.current.capturePhoto("file://nutrition.jpg"));

    expect(result.current.slots.nutrition?.uri).toBe("file://nutrition.jpg");
    expect(result.current.slots.ingredients).toBeNull();
    expect(result.current.canAnalyze).toBe(true);
  });

  it("both: capturing into each slot in either order fills both, independent of order", async () => {
    const { result } = await renderHook(() => useCaptureState());

    await act(() => result.current.capturePhoto("file://ingredients.jpg"));
    await act(() => result.current.setActiveTarget("nutrition"));
    await act(() => result.current.capturePhoto("file://nutrition.jpg"));

    expect(result.current.slots.ingredients?.uri).toBe("file://ingredients.jpg");
    expect(result.current.slots.nutrition?.uri).toBe("file://nutrition.jpg");
    expect(result.current.canAnalyze).toBe(true);
  });

  it("neither: with no capture yet, Analyze stays blocked", async () => {
    const { result } = await renderHook(() => useCaptureState());
    expect(result.current.slots.ingredients).toBeNull();
    expect(result.current.slots.nutrition).toBeNull();
    expect(result.current.canAnalyze).toBe(false);
  });
});

describe("useCaptureState — retake and reset", () => {
  it("retake clears only the targeted slot, leaving the other and canAnalyze intact if it's still filled", async () => {
    const { result } = await renderHook(() => useCaptureState());
    await act(() => result.current.capturePhoto("file://ingredients.jpg"));
    await act(() => result.current.setActiveTarget("nutrition"));
    await act(() => result.current.capturePhoto("file://nutrition.jpg"));

    await act(() => result.current.retake("ingredients"));

    expect(result.current.slots.ingredients).toBeNull();
    expect(result.current.slots.nutrition?.uri).toBe("file://nutrition.jpg");
    expect(result.current.canAnalyze).toBe(true);
  });

  it("reset clears both slots and re-blocks Analyze", async () => {
    const { result } = await renderHook(() => useCaptureState());
    await act(() => result.current.capturePhoto("file://ingredients.jpg"));

    await act(() => result.current.reset());

    expect(result.current.slots.ingredients).toBeNull();
    expect(result.current.slots.nutrition).toBeNull();
    expect(result.current.canAnalyze).toBe(false);
  });
});
