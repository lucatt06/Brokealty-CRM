"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Car, Fuel, Gauge, MessageCircle, Cog } from "lucide-react";
import { formatCurrency, buildWhatsAppUrl } from "@/lib/utils";
import type { PublicVehicle } from "@/lib/catalog/public-vehicle";

const FUEL_LABEL: Record<string, string> = { GASOLINA: "Gasolina", DIESEL: "Diésel", HIBRIDO: "Híbrido", ELECTRICO: "Eléctrico", GAS: "Gas" };
const TRANS_LABEL: Record<string, string> = { AUTOMATICO: "Automático", MANUAL: "Manual", CVT: "CVT", SEMI_AUTO: "Semi-automático" };

type Props = {
  slug: string;
  workspaceName: string;
  whatsappNumber: string | null;
  primaryColor: string | null;
  vehicle: PublicVehicle;
};

export function CatalogVehicleClient({ slug, workspaceName, whatsappNumber, primaryColor, vehicle }: Props) {
  const [activePhoto, setActivePhoto] = useState(0);
  const color = primaryColor || "#2563EB";
  const title = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;
  const waMessage = `Hola, me interesa el ${title}${vehicle.trim ? ` ${vehicle.trim}` : ""}. ¿Me pueden dar más información?`;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link href={`/catalogo/${slug}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" /> {workspaceName}
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 grid md:grid-cols-2 gap-6">
        <div>
          <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden">
            {vehicle.photos[activePhoto] ? (
              <img src={vehicle.photos[activePhoto].url} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center"><Car className="h-14 w-14 text-gray-200" /></div>
            )}
          </div>
          {vehicle.photos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {vehicle.photos.map((p, i) => (
                <button key={p.id} onClick={() => setActivePhoto(i)}
                  className={`h-14 w-20 shrink-0 rounded-lg overflow-hidden border-2 ${i === activePhoto ? "" : "border-transparent"}`}
                  style={i === activePhoto ? { borderColor: color } : undefined}>
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900">{title}</h1>
          <p className="text-[13px] text-gray-400 mb-2">{[vehicle.trim, vehicle.color].filter(Boolean).join(" · ")}</p>
          <p className="text-[26px] font-extrabold mb-4" style={{ color }}>
            {vehicle.priceDOP != null ? formatCurrency(vehicle.priceDOP, "DOP") : "Consultar precio"}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <Spec icon={Gauge} label="Kilometraje" value={`${(vehicle.mileage ?? 0).toLocaleString("es-DO")} km`} />
            <Spec icon={Fuel} label="Combustible" value={FUEL_LABEL[vehicle.fuelType] ?? vehicle.fuelType} />
            <Spec icon={Cog} label="Transmisión" value={TRANS_LABEL[vehicle.transmission] ?? vehicle.transmission} />
            {vehicle.doors != null && <Spec icon={Car} label="Puertas" value={String(vehicle.doors)} />}
          </div>

          {vehicle.description && (
            <p className="text-[13px] text-gray-600 leading-relaxed mb-5">{vehicle.description}</p>
          )}

          {vehicle.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {vehicle.features.map((f) => (
                <span key={f} className="text-[11px] font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">{f}</span>
              ))}
            </div>
          )}

          {whatsappNumber && (
            <a href={buildWhatsAppUrl(whatsappNumber, waMessage)} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: "#25D366" }}>
              <MessageCircle className="h-4 w-4" /> Preguntar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
      <Icon className="h-4 w-4 text-gray-400" />
      <div>
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className="text-[12px] font-semibold text-gray-800">{value}</p>
      </div>
    </div>
  );
}
