export interface ScheduledJob {
  readonly failureCode: string;
  run(scheduledTime: number): Promise<unknown>;
}
