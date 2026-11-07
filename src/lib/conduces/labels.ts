import type { ConduceReason, ConduceStatus, ConduceType } from "@prisma/client";

export const CONDUCE_REASON_LABELS: Record<ConduceReason, string> = {
  INGRESO_LOTE: "Ingreso al lote",
  PRUEBA_MANEJO: "Prueba de manejo",
  TRASLADO_TALLER: "Traslado a taller",
  TRASLADO_SUCURSAL: "Traslado entre sucursales",
  ENTREGA_CLIENTE: "Entrega al cliente",
  DEVOLUCION_PRUEBA: "Devolución de prueba de manejo",
  OTRO: "Otro",
};

export const CONDUCE_STATUS_LABELS: Record<ConduceStatus, string> = {
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
  VENCIDO: "Vencido",
};

export const CONDUCE_TYPE_LABELS: Record<ConduceType, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
};
