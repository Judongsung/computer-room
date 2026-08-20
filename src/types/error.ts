export interface ErrorDefinition {
  readonly code: string;
  readonly message: string;
}

export interface AppErrorDefinition extends ErrorDefinition {
  readonly status: number;
}
