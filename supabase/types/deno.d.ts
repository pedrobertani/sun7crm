// Superfície de Deno usada pelo adaptador; permite checagem local sem instalar runtime.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
