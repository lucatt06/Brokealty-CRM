// El registro real vive en src/lib/actions/registry.ts, compartido con el
// ejecutor de automatizaciones (Fase D). Este archivo queda como shim para
// no tener que tocar los imports existentes en orchestrator.ts.
export { ACTION_REGISTRY as TOOL_REGISTRY, buildAnthropicTools, executeTool } from "@/lib/actions/registry";
