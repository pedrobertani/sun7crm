export type JsonObject = Record<string, unknown>;
export interface ErrorContext {
  operationId?: string | null;
  actorId?: string | null;
  status?: number;
  message?: string;
  exceptionType?: string;
  trace?: string;
}

// Porta de infraestrutura. Cada endpoint mantém seu próprio caso de uso.
export interface Backend {
  authenticate(token: string): Promise<string | null>;
  rpc<T>(name: string, args: JsonObject): Promise<T>;
  createUser(input: {
    email: string;
    password: string;
    operationId: string;
  }): Promise<{ id: string }>;
  deleteUser(userId: string): Promise<void>;
  resetPassword(userId: string, password: string): Promise<void>;
  report(code: string, requestId: string, context?: ErrorContext): void | Promise<void>;
}

export interface CommandContext {
  actorId: string;
  requestId: string;
  traceId?: string;
  body: JsonObject;
  backend: Backend;
}

export type Command = (context: CommandContext) => Promise<{ status: number; data: JsonObject }>;
