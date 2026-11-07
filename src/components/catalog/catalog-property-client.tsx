"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bath, BedDouble, Building2, Car, ExternalLink, MapPin, MessageCircle, Ruler, Layers, Calendar } from "lucide-react";
import { formatCurrency, buildWhatsAppUrl } from "@/lib/utils";
import { LISTING_TYPE_LABELS, PROPERTY_TYPE_LABELS, propertyLocation } from "@/lib/properties/labels";
import { publicPriceLabel } from "@/components/catalog/catalog-client";
import type { PublicProperty } from "@/lib/catalog/public-property";

type Props = {
  slug: string;
  workspaceName: string;
  whatsappNumber: string | null;
  primaryColor: string | null;
  property: PublicProperty;
};

export function CatalogPropertyClient({ slug, workspaceName, whatsappNumber, primaryColor, property }: Props) {
  const [activePhoto, setActivePhoto] = useState(0);
  const color = primaryColor || "#2563EB";
  const waMessage = `Hola, me interesa la propiedad "${property.title}". ¿Me pueden dar más información?`;

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
            {property.photos[activePhoto] ? (
              <img src={property.photos[activePhoto].url} alt={property.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center"><Building2 className="h-14 w-14 text-gray-200" /></div>
            )}
          </div>
          {property.photos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {property.photos.map((p, i) => (
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
          <p className="text-[12px] text-gray-400 mb-1">
            {PROPERTY_TYPE_LABELS[property.propertyType]} · {LISTING_TYPE_LABELS[property.listingType]}
            {property.projectName ? ` · ${property.projectName}` : ""}
          </p>
          <h1 className="text-[22px] font-extrabold text-gray-900">{property.title}</h1>
          <p className="text-[13px] text-gray-500 flex items-center gap-1 mb-2"><MapPin className="h-3.5 w-3.5" /> {propertyLocation(property) || "—"}</p>
          <p className="text-[26px] font-extrabold mb-1" style={{ color }}>{publicPriceLabel(property)}</p>
          {property.maintenanceDOP != null && (
            <p className="text-[12px] text-gray-500 mb-3">Mantenimiento: {formatCurrency(property.maintenanceDOP, "DOP")} /mes</p>
          )}

          <div className="grid grid-cols-2 gap-3 my-4">
            {property.bedrooms != null && <Spec icon={BedDouble} label="Habitaciones" value={String(property.bedrooms)} />}
            {property.bathrooms != null && <Spec icon={Bath} label="Baños" value={String(property.bathrooms)} />}
            {property.parkingSpaces != null && <Spec icon={Car} label="Parqueos" value={String(property.parkingSpaces)} />}
            {property.constructionM2 != null && <Spec icon={Ruler} label="Construcción" value={`${property.constructionM2} m²`} />}
            {property.landM2 != null && <Spec icon={Ruler} label="Terreno" value={`${property.landM2} m²`} />}
            {property.floorNumber != null && <Spec icon={Layers} label="Piso / nivel" value={String(property.floorNumber)} />}
            {property.yearBuilt != null && <Spec icon={Calendar} label="Año" value={String(property.yearBuilt)} />}
            {property.furnished && <Spec icon={Building2} label="Estado" value="Amueblada" />}
          </div>

          {property.description && <p className="text-[13px] text-gray-600 leading-relaxed mb-5 whitespace-pre-line">{property.description}</p>}

          {property.features.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {property.features.map((f) => <span key={f} className="text-[11px] font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">{f}</span>)}
            </div>
          )}

          {(property.videoUrl || property.virtualTourUrl) && (
            <div className="flex gap-4 mb-5">
              {property.virtualTourUrl && <a href={property.virtualTourUrl} target="_blank" rel="noreferrer" className="text-[12.5px] font-medium flex items-center gap-1" style={{ color }}><ExternalLink className="h-3.5 w-3.5" /> Tour virtual</a>}
              {property.videoUrl && <a href={property.videoUrl} target="_blank" rel="noreferrer" className="text-[12.5px] font-medium flex items-center gap-1" style={{ color }}><ExternalLink className="h-3.5 w-3.5" /> Ver video</a>}
            </div>
          )}

          {whatsappNumber && (
            <a href={buildWhatsAppUrl(whatsappNumber, waMessage)} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: "#25D366" }}>
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
