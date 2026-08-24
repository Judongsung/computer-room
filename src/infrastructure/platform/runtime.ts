import type { Clock, IdGenerator } from "@/types/platform/runtime";

export class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
