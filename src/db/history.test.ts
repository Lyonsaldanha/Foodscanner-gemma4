import type { ScanResult } from "../types/scan";
import { deserializeScanResult, getAllScans, getScanById, getScanSummaries, insertScan, serializeScanResult } from "./history";

// expo-sqlite needs a real native bridge, unavailable in this sandbox (no
// device) — mocked with a tiny in-memory array standing in for the table,
// so insertScan/getScanById/getAllScans exercise their real SQL-shaped
// code path (not just the pure serialize/deserialize functions below).
jest.mock("expo-sqlite", () => {
  const rows: { id: number; scannedAt: string; productLabel: string | null; overall: string | null; scanResultJson: string }[] = [];
  let nextId = 1;
  const fakeDb = {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async (_sql: string, params: [string, string | null, string | null, string]) => {
      const [scannedAt, productLabel, overall, scanResultJson] = params;
      const id = nextId++;
      rows.push({ id, scannedAt, productLabel, overall, scanResultJson });
      return { lastInsertRowId: id, changes: 1 };
    }),
    getFirstAsync: jest.fn(async (_sql: string, params: [number]) => {
      const [id] = params;
      return rows.find((r) => r.id === id) ?? null;
    }),
    getAllAsync: jest.fn(async () => [...rows].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))),
  };
  return { openDatabaseAsync: jest.fn(async () => fakeDb) };
});

const fullScanResult: ScanResult = {
  scannedAt: "2026-08-12T10:00:00.000Z",
  productLabel: "Golden Crumb Shortbread Biscuits",
  ingredients: [
    {
      rawName: "Maida",
      plainMeaning: "Highly refined wheat flour",
      category: "refined_flour",
      source: "glossary",
      isHiddenName: true,
      allergen: true,
      confidence: 0.97,
    },
    {
      rawName: "Salt",
      plainMeaning: null,
      category: null,
      source: null,
      isHiddenName: false,
      allergen: false,
      confidence: 0.98,
    },
  ],
  allergensDetected: ["Wheat (Gluten)", "Soya"],
  isVegetarian: true,
  fssaiLicenseNumber: "10023045001987",
  language: "English",
  nutrition: {
    energyKcal: 520,
    proteinG: 5,
    totalCarbG: 65,
    sugarG: 28,
    addedSugarG: 20,
    fiberG: 1.5,
    totalFatG: 28,
    saturatedFatG: 17,
    transFatG: 0.2,
    sodiumMg: 350,
    micronutrients: [{ name: "Calcium", amount: 120, unit: "mg" }],
  },
  balance: {
    flags: { sugar: "high", saturatedFat: "high", sodium: "medium", protein: "low", fiber: "low" },
    rulesTriggered: ["High in sugar (28g/100g, threshold >22.5g/100g)"],
    overall: "occasional_treat",
    summary: "High in sugar and saturated fat — best as an occasional treat.",
  },
  notes: "No real butter; uses artificial butter flavouring.",
};

describe("serializeScanResult / deserializeScanResult — round-trip fidelity", () => {
  it("round-trips every field of a fully-populated ScanResult with no loss", () => {
    const row = serializeScanResult(fullScanResult);
    const roundTripped = deserializeScanResult({ id: 1, ...row });
    expect(roundTripped).toEqual(fullScanResult);
  });

  it("round-trips a ScanResult with only the required fields (nulls/empties throughout)", () => {
    const minimal: ScanResult = {
      scannedAt: "2026-08-12T10:00:00.000Z",
      productLabel: null,
      ingredients: null,
      allergensDetected: [],
      isVegetarian: null,
      fssaiLicenseNumber: null,
      language: null,
      nutrition: null,
      balance: null,
      notes: null,
    };
    const row = serializeScanResult(minimal);
    const roundTripped = deserializeScanResult({ id: 2, ...row });
    expect(roundTripped).toEqual(minimal);
  });
});

describe("insertScan / getScanById / getAllScans — write then read back", () => {
  it("writes a scan and reads the identical ScanResult back by id", async () => {
    const id = await insertScan(fullScanResult);
    const readBack = await getScanById(id);
    expect(readBack).toEqual(fullScanResult);
  });

  it("returns null for an id that was never written", async () => {
    const readBack = await getScanById(999999);
    expect(readBack).toBeNull();
  });

  it("getAllScans includes every scan written so far, each with full fidelity", async () => {
    const secondScan: ScanResult = { ...fullScanResult, scannedAt: "2026-08-12T11:00:00.000Z", productLabel: "Second Product" };
    await insertScan(secondScan);

    const all = await getAllScans();
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.some((s) => s.productLabel === "Second Product")).toBe(true);
    expect(all.some((s) => s.productLabel === "Golden Crumb Shortbread Biscuits")).toBe(true);
  });
});

describe("getScanSummaries — the History list screen's data source", () => {
  it("includes every written scan as a summary, most recent first, without needing the full blob", async () => {
    await insertScan(fullScanResult);
    const secondScan: ScanResult = {
      ...fullScanResult,
      scannedAt: "2026-08-12T12:00:00.000Z",
      productLabel: "Third Product",
      balance: { ...fullScanResult.balance!, overall: "everyday" },
    };
    const secondId = await insertScan(secondScan);

    const summaries = await getScanSummaries();
    expect(summaries.length).toBeGreaterThanOrEqual(2);

    // toMatchObject, not toEqual: the mocked expo-sqlite (unlike real
    // SQLite) doesn't simulate column projection, so getAllAsync returns
    // full rows including scanResultJson regardless of the SELECT list —
    // this only asserts the summary fields getScanSummaries actually reads.
    const secondSummary = summaries.find((s) => s.id === secondId);
    expect(secondSummary).toMatchObject({
      id: secondId,
      scannedAt: "2026-08-12T12:00:00.000Z",
      productLabel: "Third Product",
      overall: "everyday",
    });
    // Most-recent-first: the just-inserted scan (latest scannedAt) is first.
    expect(summaries[0].id).toBe(secondId);
  });
});
