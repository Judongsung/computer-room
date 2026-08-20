import type { MemoRecord } from "./memo";

export interface MemoRepository {
  listAll(): Promise<MemoRecord[]>;
  upsert(record: MemoRecord): Promise<void>;
}
