"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bath, BedDouble, Building2, Car, MapPin, MessageCircle, Ruler, Search } from "lucide-react";
import { formatCurrency, buildWhatsAppUrl } from "@/lib/utils";
import {
  LISTING_TYPE_LABELS, PROPERTY_TYPE_LABELS, propertyLocation,
} from "@/lib/properties/labels";
import type { PublicProperty } from "@/lib/catalog/public-property";
import type { ListingType, PropertyType } from "@prisma/client";

type Props = {
  slug: string;
  workspaceName: string;
  whatsappNumber: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
  heroImageUrl: string | null;
  featuredIds: string[];
  properties: PublicProperty[];
};

export function publicPriceLabel(p: Pick<PublicProperty, "priceDOP" | "priceUSD" | "listingType">) {
  const parts = [
    p.priceUSD != null ? formatCurrency(p.priceUSD, "USD") : null,
    p.priceDOP != null ? formatCurrency(p.priceDOP, "DOP") : null,
  ].filter(Boolean);
  if (!parts.length) return "Consultar precio";
  return parts.join(" · ") + (p.listingType === "ALQUILER" ? " /mes" : "");
}

export function CatalogClient({ slug, workspaceName, whatsappNumber, logoUrl, primaryColor, tagline, heroImageUrl, featuredIds, properties }: Props) {
  const [type, setType] = useState<PropertyType | "">("");
  const [listing, setListing] = useState<ListingType | "">("");
  const [city, setCity] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [search, setSearch] = useState("");
  const color = primaryColor || "#2563EB";

  const types = useMemo(() => Array.from(new Set(properties.map((p) => p.propertyType))), [properties]);
  const cities = useMemo(() => Array.from(new Set(properties.map((p) => p.city).filter((c): c is string => !!c))).sort(), [properties]);

  const filtered = useMemo(() => {
    const list = properties.filter((p) => {
      if (type && p.propertyType !== type) return false;
      if (listing && p.listingType !== listing && p.listingType !== "VENTA_ALQUILER") return false;
      if (city && p.city !== city) return false;
      if (bedrooms && (p.bedrooms ?? 0) < Number(bedrooms)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${p.title} ${p.sector ?? ""} ${p.city ?? ""} ${p.projectName ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    // Destacadas primero, el resto conserva el orden (más recientes arriba).
    return [...list].sort((a, b) => Number(featuredIds.includes(b.id)) - Number(featuredIds.includes(a.id)));
  }, [properties, type, listing, city, bedrooms, search, featuredIds]);

  const selectCls = "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none";

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={workspaceName} className="h-8 w-8 rounded-md object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-md flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: color }}>
              {workspaceName[0]}
            </div>
          )}
          <div>
            <p className="text-[14px] font-bold text-gray-900">{workspaceName}</p>
            {tagline && <p className="text-[11px] text-gray-500">{tagline}</p>}
          </div>
          {whatsappNumber && (
            <a href={buildWhatsAppUrl(whatsappNumber, "Hola, quiero información sobre sus propiedades.")}
              target="_blank" rel="noreferrer"
              className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-white rounded-full px-3 py-1.5"
              style={{ backgroundColor: "#25D366" }}>
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          )}
        </div>
      </header>

      {heroImageUrl && (
        <div className="h-48 w-full bg-gray-200 overflow-hidden">
          <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por zona, proyecto…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-1 bg-white"
              style={{ ["--tw-ring-color" as string]: color }} />
          </div>
          <select value={listing} onChange={(e) => setListing(e.target.value as ListingType | "")} className={selectCls}>
            <option value="">Comprar o alquilar</option>
            <option value="VENTA">{LISTING_TYPE_LABELS.VENTA}</option>
            <option value="ALQUILER">{LISTING_TYPE_LABELS.ALQUILER}</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value as PropertyType | "")} className={selectCls}>
            <option value="">Todos los tipos</option>
            {types.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>)}
          </select>
          {cities.length > 1 && (
            <select value={city} onChange={(e) => setCity(e.target.value)} className={selectCls}>
              <option value="">Todas las ciudades</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className={selectCls}>
            <option value="">Habitaciones</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <Building2 className="h-12 w-12 opacity-20" />
            <p className="text-sm">{properties.length === 0 ? "No hay propiedades disponibles por el momento." : "Ninguna propiedad coincide con tu búsqueda."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {filtered.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/catalogo/${slug}/${p.id}`} className="block bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {p.photos[0] ? (
                      <img src={p.photos[0].url} alt={p.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center"><Building2 className="h-10 w-10 text-gray-200" /></div>
                    )}
                    <span className="absolute top-2 left-2 text-[10.5px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: color }}>
                      {LISTING_TYPE_LABELS[p.listingType]}
                    </span>
                    {featuredIds.includes(p.id) && (
                      <span className="absolute top-2 right-2 text-[10.5px] font-semibold bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full">Destacada</span>
                    )}
                  </div>
                  <div className="p-3.5">
                    <p className="text-[11px] text-gray-400 mb-0.5">{PROPERTY_TYPE_LABELS[p.propertyType]}{p.projectName ? ` · ${p.projectName}` : ""}</p>
                    <p className="text-[14px] font-bold text-gray-900 truncate">{p.title}</p>
                    <p className="text-[11.5px] text-gray-500 flex items-center gap-1 mb-1.5"><MapPin className="h-3 w-3" /> {propertyLocation(p) || "—"}</p>
                    <p className="text-[16px] font-extrabold mb-2" style={{ color }}>{publicPriceLabel(p)}</p>
                    <div className="flex items-center gap-3 text-[11.5px] text-gray-500">
                      {p.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {p.bedrooms}</span>}
                      {p.bathrooms != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms}</span>}
                      {p.parkingSpaces != null && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {p.parkingSpaces}</span>}
                      {(p.constructionM2 ?? p.landM2) != null && <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {p.constructionM2 ?? p.landM2} m²</span>}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
