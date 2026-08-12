import { MODEL_INPUT_SIZE, preprocessImage } from "./preprocess";

// expo-image-manipulator has no jest-expo mock and needs a real native
// bridge, unavailable in this sandbox (no device). This mocks the module to
// verify preprocessImage calls it correctly and maps the result — it can't
// verify real image manipulation happens, only that the orchestration is
// wired up as designed. Jest only allows referencing "mock"-prefixed
// variables from inside a jest.mock() factory (it's hoisted above normal
// declarations), hence the naming here.
const mockSaveAsync = jest.fn();
const mockRenderAsync = jest.fn(() => Promise.resolve({ saveAsync: mockSaveAsync }));
const mockResize = jest.fn((_size: { width: number; height: number }) => ({ renderAsync: mockRenderAsync }));
const mockManipulate = jest.fn((_uri: string) => ({ resize: mockResize }));

jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: (uri: string) => mockManipulate(uri) },
  SaveFormat: { JPEG: "jpeg" },
}));

describe("preprocessImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRenderAsync.mockResolvedValue({ saveAsync: mockSaveAsync });
    mockSaveAsync.mockResolvedValue({ uri: "file://resized.jpg", width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE });
  });

  it("resizes to the model's 896x896 input resolution and maps the saved result", async () => {
    const result = await preprocessImage("file://original.jpg");

    expect(mockManipulate).toHaveBeenCalledWith("file://original.jpg");
    expect(mockResize).toHaveBeenCalledWith({ width: 896, height: 896 });
    expect(mockSaveAsync).toHaveBeenCalledWith(expect.objectContaining({ format: "jpeg" }));
    expect(result).toEqual({ uri: "file://resized.jpg", width: 896, height: 896 });
  });
});
