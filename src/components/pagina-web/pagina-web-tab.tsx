"use client";

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { updateWebsiteConfig } from "@/app/actions/website-config";
import { FieldLabel } from "@/components/agentes/action-modals";

export type WebsiteConfigInfo = {
  subdomain: string | null; isPublished: boolean;
  logoUrl: string | null; primaryColor: string | null; heroImageUrl: string | null;
  tagline: string | null; aboutText: string | null; whatsappNumber: string | null;
  addressText: string | null; businessHoursText: string | null;
  showPrices: boolean; metaTitle: string | null; metaDescription: string | null;
} | null;

/** Formulario de configuración del catálogo público — usado tanto en /pagina-web como en Configuración. */
export function PaginaWebTab({ workspaceId, config, slug }: { workspaceId: string; config: WebsiteConfigInfo; slug: string }) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(config?.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(config?.primaryColor ?? "#2563EB");
  const [heroImageUrl, setHeroImageUrl] = useState(config?.heroImageUrl ?? "");
  const [tagline, setTagline] = useState(config?.tagline ?? "");
  const [aboutText, setAboutText] = useState(config?.aboutText ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(config?.whatsappNumber ?? "");
  const [addressText, setAddressText] = useState(config?.addressText ?? "");
  const [businessHoursText, setBusinessHoursText] = useState(config?.businessHoursText ?? "");
  const [showPrices, setShowPrices] = useState(config?.showPrices ?? true);
  const [isPublished, setIsPublished] = useState(config?.isPublished ?? false);
  const [metaTitle, setMetaTitle] = useState(config?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(config?.metaDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const catalogUrl = `/catalogo/${slug}`;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await updateWebsiteConfig(workspaceId, {
      logoUrl: logoUrl.trim() || null,
      primaryColor: primaryColor.trim() || null,
      heroImageUrl: heroImageUrl.trim() || null,
      tagline: tagline.trim() || null,
      aboutText: aboutText.trim() || null,
      whatsappNumber: whatsappNumber.trim() || null,
      addressText: addressText.trim() || null,
      businessHoursText: businessHoursText.trim() || null,
      showPrices,
      isPublished,
      metaTitle: metaTitle.trim() || null,
      metaDescription: metaDescription.trim() || null,
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <p className="text-[13px] font-semibold text-gray-900">Catálogo público</p>
          <p className="text-[11.5px] text-muted-foreground">Muestra las propiedades disponibles de tu catálogo en una página pública, sin necesidad de sesión.</p>
        </div>
        <a href={catalogUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] text-primary hover:underline shrink-0">
          Ver catálogo <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-gray-700">Publicar catálogo</span>
        <button onClick={() => setIsPublished((v) => !v)}
          className={cn("h-5 w-9 rounded-full relative transition-colors", isPublished ? "bg-primary" : "bg-gray-200")}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", isPublished ? "left-4" : "left-0.5")} />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-gray-700">Mostrar precios públicamente</span>
        <button onClick={() => setShowPrices((v) => !v)}
          className={cn("h-5 w-9 rounded-full relative transition-colors", showPrices ? "bg-primary" : "bg-gray-200")}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", showPrices ? "left-4" : "left-0.5")} />
        </button>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Branding</p>
        <div className="space-y-3">
          <div>
            <FieldLabel>URL del logo</FieldLabel>
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
          <div>
            <FieldLabel>Imagen de portada (hero)</FieldLabel>
            <input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://…" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Color primario</FieldLabel>
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full h-9 border border-gray-200 rounded-md px-1 py-1" />
            </div>
            <div>
              <FieldLabel>Eslogan</FieldLabel>
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Contenido</p>
        <div className="space-y-3">
          <div>
            <FieldLabel>Sobre el negocio</FieldLabel>
            <textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>WhatsApp de contacto</FieldLabel>
              <input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+1 809 555 5555" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
            </div>
            <div>
              <FieldLabel>Dirección</FieldLabel>
              <input value={addressText} onChange={(e) => setAddressText(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <FieldLabel>Horario</FieldLabel>
            <input value={businessHoursText} onChange={(e) => setBusinessHoursText(e.target.value)} placeholder="Lun-Sáb 9am-6pm" className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">SEO</p>
        <div className="space-y-3">
          <div>
            <FieldLabel>Título de la página</FieldLabel>
            <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary" />
          </div>
          <div>
            <FieldLabel>Descripción</FieldLabel>
            <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] outline-none focus:border-primary resize-none" />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md px-4 py-2 transition-colors disabled:opacity-50">
          {saved ? <><Check className="h-3.5 w-3.5" /> Guardado</> : saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
