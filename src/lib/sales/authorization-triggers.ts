import { prisma } from "@/lib/prisma";
import type { AuthorizationTrigger } from "@prisma/client";

type EvaluableSalesOrder = { salePrice: number; currency: string; paymentMethod: string };
type EvaluableProperty = { minimumPrice: number | null; priceDOP: number | null; priceUSD: number | null };

/**
 * Evalúa las AuthorizationRule activas del workspace contra una orden — si no hay
 * ninguna regla activa, no se exige autorización para nadie (Documento 7, sección
 * 16.4: nunca hardcodear umbrales, todo configurable en BD).
 */
export async function evaluateAuthorizationTriggers(
  workspaceId: string,
  order: EvaluableSalesOrder,
  property: EvaluableProperty
): Promise<{ trigger: AuthorizationTrigger; detail: string }[]> {
  const rules = await prisma.authorizationRule.findMany({ where: { workspaceId, isActive: true } });
  const triggered: { trigger: AuthorizationTrigger; detail: string }[] = [];

  for (const rule of rules) {
    if (rule.trigger === "BELOW_MINIMUM_PRICE" && property.minimumPrice != null && order.salePrice < property.minimumPrice) {
      triggered.push({ trigger: rule.trigger, detail: `Precio ${order.salePrice} vs mínimo ${property.minimumPrice}` });
    }
    if (rule.trigger === "DISCOUNT_THRESHOLD" && rule.discountPercentThreshold != null) {
      const publicPrice = order.currency === "USD" ? property.priceUSD : property.priceDOP;
      if (publicPrice && publicPrice > 0) {
        const discountPercent = ((publicPrice - order.salePrice) / publicPrice) * 100;
        if (discountPercent > rule.discountPercentThreshold) {
          triggered.push({ trigger: rule.trigger, detail: `Descuento ${discountPercent.toFixed(1)}% vs umbral ${rule.discountPercentThreshold}%` });
        }
      }
    }
    if (rule.trigger === "FINANCED_SALE" && (order.paymentMethod === "FINANCIAMIENTO_BANCARIO" || order.paymentMethod === "MIXTO")) {
      triggered.push({ trigger: rule.trigger, detail: `Forma de pago: ${order.paymentMethod}` });
    }
    if (rule.trigger === "HIGH_VALUE" && rule.amountThreshold != null && order.salePrice > rule.amountThreshold) {
      triggered.push({ trigger: rule.trigger, detail: `Monto ${order.salePrice} vs umbral ${rule.amountThreshold}` });
    }
  }

  return triggered;
}

