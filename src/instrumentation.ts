/**
 * Next llama a register() al arrancar el servidor (requiere `experimental.instrumentationHook` en
 * Next 14). Todo lo que usa módulos de Node (crypto, Prisma…) vive en instrumentation-node.ts y se
 * importa solo si el runtime es Node: así el bundle Edge no intenta resolverlo.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackgroundWork } = await import("./instrumentation-node");
    startBackgroundWork();
  }
}
