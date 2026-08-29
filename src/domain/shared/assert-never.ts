export function assertNever(value: never): never {
  void value;
  throw new Error("Unhandled discriminated union member.");
}
