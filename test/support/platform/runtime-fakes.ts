import type { Clock, IdGenerator } from "@/types/platform/runtime";

export class StaticClock implements Clock {
  constructor(public timestamp: number) {}

  now(): number {
    return this.timestamp;
  }
}

export class SequenceIdGenerator implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: readonly string[]) {}

  generate(): string {
    const id = this.ids[this.index];
    if (!id) {
      throw new Error("No fake ID remains");
    }
    this.index += 1;
    return id;
  }
}

export function streamFromText(value: string): ReadableStream<Uint8Array> {
  return new Blob([value]).stream();
}
