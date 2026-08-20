export interface IdGenerator {
  generate(): string;
}

export interface Clock {
  now(): number;
}
