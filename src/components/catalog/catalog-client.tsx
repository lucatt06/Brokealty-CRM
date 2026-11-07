"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Car, Fuel, Gauge, MessageCircle, Search } from "lucide-react";
import { formatCurrency, buildWhatsAppUrl } from "@/lib/utils";
import type { PublicVehicle } from "@/lib/catalog/public-vehicle";

const FUEL_LABEL: Record<string, string> = { GASOLINA: "Gasolina", DIESEL: "Diésel", HIBRIDO: "Híbrido", ELECTRICO: "Eléctrico", GAS: "Gas" };

type Props = {
  slug: string;
  workspaceName: string;
  whatsappNumber: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
  heroImageUrl: string | null;
  vehicles: PublicVehicle[];
};

export function CatalogClient({ slug, workspaceName, whatsappNumber, logoUrl, primaryColor, tagline, heroImageUrl, vehicles }: Props) {
  const [make, setMake] = useState("");
  const [search, setSearch] = useState("");
  const color = primaryColor || "#2563EB";

  const makes = useMemo(() => Array.from(new Set(vehicles.map((v) => v.make))).sort(), [vehicles]);

  const filtered = vehicles.filter((v) => {
    if (make && v.make !== make) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${v.make} ${v.model} ${v.year} ${v.trim ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

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
            <a href={buildWhatsAppUrl(whatsappNumber, `Hola, quiero información sobre su inventario.`)}
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
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar marca, modelo, año…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-1 bg-white"
              style={{ ["--tw-ring-color" as string]: color }} />
          </div>
          <select value={make} onChange={(e) => setMake(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none">
            <option value="">Todas las marcas</option>
            {makes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <Car className="h-12 w-12 opacity-20" />
            <p className="text-sm">{vehicles.length === 0 ? "No hay vehículos disponibles por el momento." : "Ningún vehículo coincide con tu búsqueda."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
            {filtered.map((v, i) => (
              <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/catalogo/${slug}/${v.id}`}
                  className="block bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-[4/3] bg-gray-100">
                    {v.photos[0] ? (
                      <img src={v.photos[0].url} alt={`${v.make} ${v.model}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center"><Car className="h-10 w-10 text-gray-200" /></div>
                    )}
                  </div>
                  <div className="p-3.5">
                    <p className="text-[14px] font-bold text-gray-900">{v.make} {v.model} {v.year}</p>
                    <p className="text-[11px] text-gray-400 mb-1.5">{[v.trim, v.color].filter(Boolean).join(" · ") || "—"}</p>
                    <p className="text-[16px] font-extrabold mb-1.5" style={{ color }}>
                      {v.priceDOP != null ? formatCurrency(v.priceDOP, "DOP") : "Consultar precio"}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> {(v.mileage ?? 0).toLocaleString("es-DO")} km</span>
                      <span className="flex items-center gap-1"><Fuel className="h-3 w-3" /> {FUEL_LABEL[v.fuelType] ?? v.fuelType}</span>
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
