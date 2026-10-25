import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Store, type Snapshot, type SnapshotMeta } from "./store";

/** Restores the store from disk, or returns undefined when there is no usable snapshot. */
export async function loadSnapshot(file: string, meta: SnapshotMeta): Promise<Store | undefined> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return undefined;
  }
  return Store.fromSnapshot(JSON.parse(raw) as Snapshot, meta);
}

/** Writes the snapshot atomically (temp file + rename) so a crash never leaves it half-written. */
export async function saveSnapshot(file: string, store: Store, meta: SnapshotMeta): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(store.toSnapshot(meta)));
  await rename(tmp, file);
  store.dirty = false;
}
