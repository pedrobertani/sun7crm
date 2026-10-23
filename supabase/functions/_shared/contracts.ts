export type JsonObject = Record<string, unknown>;

// Porta de infraestrutura. Cada endpoint mantém seu próprio caso de uso.
export interface Backend {
  authenticate(token: string): Promise<string | null>;
  rpc<T>(name: string, args: JsonObject): Promise<T>;
  createUser(input: { email: string; operationId: string }): Promise<{ id: string }>;
  deleteUser(userId: string): Promise<void>;
  resetPassword(userId: string): Promise<void>;
  report(code: string, requestId: string): void;
}

export interface CommandContext {
  actorId: string;
  requestId: string;
  body: JsonObject;
  backend: Backend;
}

export type Command = (context: CommandContext) => Promise<{ status: number; data: JsonObject }>;
