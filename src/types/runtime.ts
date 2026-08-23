export interface IdGenerator {
  generate(): string;
}

export interface BackgroundTaskScheduler {
  schedule(task: Promise<unknown>, failureCode: string): void;
}

export interface Clock {
  now(): number;
}
