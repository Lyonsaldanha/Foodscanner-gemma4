import * as SQLite from "expo-sqlite";
import type { ScanResult } from "../types/scan";

const DB_NAME = "ingredient-lens.db";

// scannedAt/productLabel/overall are indexed convenience columns for
// list/sort queries the (not-yet-built) History screen will need;
// scanResultJson is the single source of truth for the full object — the
// convenience columns are never read back into a ScanResult, only the blob
// is, so they can never cause field loss on read.
export interface ScanHistoryRow {
  id: number;
  scannedAt: string;
  productLabel: string | null;
  overall: string | null;
  scanResultJson: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS scan_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scannedAt TEXT NOT NULL,
          productLabel TEXT,
          overall TEXT,
          scanResultJson TEXT NOT NULL
        );`
      );
      return db;
    });
  }
  return dbPromise;
}

export function serializeScanResult(result: ScanResult): Omit<ScanHistoryRow, "id"> {
  return {
    scannedAt: result.scannedAt,
    productLabel: result.productLabel,
    overall: result.balance?.overall ?? null,
    scanResultJson: JSON.stringify(result),
  };
}

export function deserializeScanResult(row: ScanHistoryRow): ScanResult {
  return JSON.parse(row.scanResultJson) as ScanResult;
}

export async function insertScan(result: ScanResult): Promise<number> {
  const db = await getDb();
  const row = serializeScanResult(result);
  const insertResult = await db.runAsync(
    `INSERT INTO scan_history (scannedAt, productLabel, overall, scanResultJson) VALUES (?, ?, ?, ?);`,
    [row.scannedAt, row.productLabel, row.overall, row.scanResultJson]
  );
  return insertResult.lastInsertRowId;
}

export async function getScanById(id: number): Promise<ScanResult | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ScanHistoryRow>(`SELECT * FROM scan_history WHERE id = ?;`, [id]);
  return row ? deserializeScanResult(row) : null;
}

export async function getAllScans(): Promise<ScanResult[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ScanHistoryRow>(`SELECT * FROM scan_history ORDER BY scannedAt DESC;`);
  return rows.map(deserializeScanResult);
}

// The History list screen only needs the indexed columns, not the full
// JSON blob every row carries — this is what those columns were added for.
export interface ScanSummary {
  id: number;
  scannedAt: string;
  productLabel: string | null;
  overall: string | null;
}

export async function getScanSummaries(): Promise<ScanSummary[]> {
  const db = await getDb();
  return db.getAllAsync<ScanSummary>(
    `SELECT id, scannedAt, productLabel, overall FROM scan_history ORDER BY scannedAt DESC;`
  );
}
