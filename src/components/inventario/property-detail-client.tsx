"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, ExternalLink } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { STATUS_CFG, primaryPhoto, priceLabel } from "@/components/inventario/inventario-client";
import { CollapsibleSection, Field } from "@/components/conversaciones/conversaciones-client";
import {
  LISTING_TYPE_LABELS, PROPERTY_TYPE_LABELS, propertyLocation,
} from "@/lib/properties/labels";
import type { ListingType, PropertyStatus, PropertyType } from "@prisma/client";

type Photo = { id: string; url: string; isPrimary: boolean; order: number };
type VTag = { id: string; name: string; color: string };

type Property = {
  id: string; status: PropertyStatus; propertyType: PropertyType; listingType: ListingType;
  title: string; projectName: string | null; sku: string | null;
  province: string | null; city: string | null; sector: string | null; address: string | null;
  bedrooms: number | null; bathrooms: number | null; parkingSpaces: number | null;
  constructionM2: number | null; landM2: number | null; floorNumber: number | null; yearBuilt: number | null;
  furnished: boolean;
  priceDOP: number | null; priceUSD: number | null; maintenanceDOP: number | null;
  minimumPrice: number | null; commissionPct: number | null;
  ownerName: string | null; ownerPhone: string | null; ownerEmail: string | null;
  capturedBy: { id: string; name: string } | null;
  videoUrl: string | null; virtualTourUrl: string | null;
  listedAt: string | null; soldDate: string | null;
  description: string | null; features: string[];
  photos: Photo[]; tags: VTag[];
  priceHistory: { id: string; priceDOP: number | null; priceUSD: number | null; note: string | null; createdAt: string }[];
  leads: { id: string; firstName: string; lastName: string | null; stage: string | null }[];
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function PropertyDetailClient({ property }: { property: Property }) {
  const router = useRouter();
  const photo = primaryPhoto(property.photos);
  const cfg = STATUS_CFG[property.status];
  const m2 = (v: number | null) => (v != null ? `${v} m²` : "—");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-12 flex items-center gap-3 border-b border-border bg-card px-3 shrink-0">
        <button onClick={() => router.push("/inventario")} title="Volver al Catálogo"
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-[14px] font-semibold text-foreground truncate">{property.title}</h1>
        <Badge className={cn("text-[11px] border font-medium shrink-0", cfg.bg, cfg.color, cfg.border)}>{cfg.label}</Badge>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Columna 1: resumen */}
        <div className="w-[340px] shrink-0 border-r border-border bg-white overflow-y-auto">
          <div className="aspect-[4/3] bg-gray-100">
            {photo ? (
              <img src={photo.url} alt={property.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center"><Building2 className="h-10 w-10 text-gray-200" /></div>
            )}
          </div>
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[16px] font-extrabold text-primary">{priceLabel(property)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {PROPERTY_TYPE_LABELS[property.propertyType]} · {LISTING_TYPE_LABELS[property.listingType]}
              {property.projectName ? ` · ${property.projectName}` : ""}
            </p>
            <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" /> {propertyLocation(property) || "Sin ubicación"}</p>
          </div>

          <CollapsibleSection title="Características" open onToggle={() => {}}>
            <Field label="Habitaciones" value={property.bedrooms != null ? String(property.bedrooms) : "—"} />
            <Field label="Baños" value={property.bathrooms != null ? String(property.bathrooms) : "—"} />
            <Field label="Parqueos" value={property.parkingSpaces != null ? String(property.parkingSpaces) : "—"} />
            <Field label="Construcción" value={m2(property.constructionM2)} />
            <Field label="Terreno" value={m2(property.landM2)} />
            {property.floorNumber != null && <Field label="Piso / nivel" value={String(property.floorNumber)} />}
            {property.yearBuilt != null && <Field label="Año de construcción" value={String(property.yearBuilt)} />}
            <Field label="Amueblada" value={property.furnished ? "Sí" : "No"} />
          </CollapsibleSection>

          {property.features.length > 0 && (
            <CollapsibleSection title="Amenidades" open onToggle={() => {}}>
              <div className="flex flex-wrap gap-1">
                {property.features.map((f) => <span key={f} className="text-[10.5px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{f}</span>)}
              </div>
            </CollapsibleSection>
          )}

          {property.tags.length > 0 && (
            <div className="px-4 py-3 flex flex-wrap gap-1">
              {property.tags.map((t) => (
                <span key={t.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${t.color}18`, color: t.color }}>{t.name}</span>
              ))}
            </div>
          )}
        </div>

        {/* Columna 2: gestión interna */}
        <div className="flex-1 overflow-y-auto bg-[#F5F5F5] p-6 space-y-4">
          {property.photos.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Galería</h2>
              <div className="grid grid-cols-4 gap-2">
                {property.photos.map((p) => <img key={p.id} src={p.url} alt="" className="aspect-square w-full object-cover rounded-lg border border-gray-100" />)}
              </div>
            </div>
          )}

          {property.description && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Descripción</h2>
              <p className="text-[13px] text-gray-700 whitespace-pre-line">{property.description}</p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Gestión interna</h2>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Código" value={property.sku ?? "—"} />
              <Field label="Publicada" value={fmtDate(property.listedAt)} />
              <Field label={property.status === "ALQUILADO" ? "Alquilada" : "Cerrada"} value={fmtDate(property.soldDate)} />
              <Field label="Propietario" value={property.ownerName ?? "—"} />
              <Field label="Teléfono" value={property.ownerPhone ?? "—"} />
              <Field label="Correo" value={property.ownerEmail ?? "—"} />
              <Field label="Captada por" value={property.capturedBy?.name ?? "—"} />
              <Field label="Comisión pactada" value={property.commissionPct != null ? `${property.commissionPct}%` : "—"} />
              <Field label="Precio mínimo" value={property.minimumPrice != null ? formatCurrency(property.minimumPrice, property.priceUSD != null ? "USD" : "DOP") : "—"} />
              {property.maintenanceDOP != null && <Field label="Mantenimiento mensual" value={formatCurrency(property.maintenanceDOP, "DOP")} />}
              {property.address && <Field label="Dirección" value={property.address} />}
            </div>
            {(property.videoUrl || property.virtualTourUrl) && (
              <div className="flex gap-3 mt-3">
                {property.videoUrl && <a href={property.videoUrl} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Video</a>}
                {property.virtualTourUrl && <a href={property.virtualTourUrl} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Tour virtual</a>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Interesados</h2>
              {property.leads.length === 0 ? (
                <p className="text-[12px] text-gray-400">Ningún lead ha mostrado interés todavía.</p>
              ) : (
                <ul className="space-y-1.5">
                  {property.leads.map((l) => (
                    <li key={l.id} className="flex items-center justify-between text-[12.5px]">
                      <Link href={`/leads/${l.id}`} className="text-primary hover:underline">{l.firstName} {l.lastName ?? ""}</Link>
                      <span className="text-gray-400 text-[11px]">{l.stage ?? ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Historial de precio</h2>
              {property.priceHistory.length === 0 ? (
                <p className="text-[12px] text-gray-400">Sin cambios de precio.</p>
              ) : (
                <ul className="space-y-1.5">
                  {property.priceHistory.map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-[12px] text-gray-600">
                      <span>{fmtDate(h.createdAt)} · {h.note ?? ""}</span>
                      <span className="font-medium">
                        {[h.priceUSD != null ? formatCurrency(h.priceUSD, "USD") : null, h.priceDOP != null ? formatCurrency(h.priceDOP, "DOP") : null].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
