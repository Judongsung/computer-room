export interface ChecklistRetentionSettings {
  readonly retentionDays: number | null;
}

export interface ChecklistRetentionRepository {
  getSettings(): Promise<ChecklistRetentionSettings>;
  saveRetentionDays(retentionDays: number | null): Promise<void>;
  purgeBefore(businessDate: string, timestamp: number): Promise<number>;
}

export interface ChecklistRetentionUseCases {
  getSettings(): Promise<ChecklistRetentionSettings>;
  updateRetentionDays(retentionDays: number | null): Promise<ChecklistRetentionSettings>;
}
