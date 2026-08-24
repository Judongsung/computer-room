import type { MemoRecord } from "@/types/widgets/memo";

export interface MemoRepository {
  listAll(): Promise<MemoRecord[]>;
  upsert(record: MemoRecord): Promise<void>;
}
