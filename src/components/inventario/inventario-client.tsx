"use client";

import { useState, useMemo, useRef, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Plus, Search, X, ChevronDown, Star, Copy, Trash2, Edit2, MoreHorizontal, Building2,
  BedDouble, Bath, Ruler, MapPin, Image as ImageIcon, LayoutGrid, List as ListIcon,
  ArrowUpDown, DollarSign, AlertTriangle, ChevronLeft, ChevronRight, UploadCloud, Loader2,
  Link2, FileText, Car, Home,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  createProperty, updateProperty, updatePropertyStatus, deleteProperty, duplicateProperty,
  addPropertyPhoto, removePropertyPhoto, setPrimaryPhoto, reorderPropertyPhotos,
  setPropertyTags, createTag, resolveMapsLink,
} from "@/app/actions/properties";
import { uploadPropertyPhotoFile, resolvePhotoUrl } from "@/app/actions/storage";
import {
  LISTING_TYPES, LISTING_TYPE_LABELS, PROPERTY_STATUSES, PROPERTY_STATUS_LABELS, PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS, SUGGESTED_FEATURES, propertyLocation, propertySpecs,
} from "@/lib/properties/labels";
import type { ListingType, PropertyStatus, PropertyType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────
type Photo = { id: string; url: string; isPrimary: boolean; order: number };
type PriceEntry = { id: string; priceDOP: number | null; priceUSD: number | null; note: string | null; createdAt: string };
type VTag = { id: string; name: string; color: string };
type Member = { id: string; name: string };

type Property = {
  id: string; sku: string | null; status: PropertyStatus;
  propertyType: PropertyType; listingType: ListingType; title: string; projectName: string | null;
  province: string | null; city: string | null; sector: string | null; address: string | null;
  latitude: number | null; longitude: number | null;
  bedrooms: number | null; bathrooms: number | null; parkingSpaces: number | null;
  constructionM2: number | null; landM2: number | null; floorNumber: number | null; yearBuilt: number | null;
  furnished: boolean;
  priceDOP: number | null; priceUSD: number | null; maintenanceDOP: number | null;
  minimumPrice: number | null; commissionPct: number | null;
  ownerName: string | null; ownerPhone: string | null; ownerEmail: string | null; capturedById: string | null;
  videoUrl: string | null; virtualTourUrl: string | null;
  daysListed: number; listedAt: string | null; soldDate: string | null;
  description: string | null; features: string[];
  photos: Photo[]; tags: VTag[]; priceHistory: PriceEntry[];
  dealsCount: number; leadsCount: number;
  createdAt: string; updatedAt: string;
};

type Kpis = { total: number; disponibles: number; reservadas: number; cerradasMes: number; valorCatalogo: number; avgDias: number };

// ── Constants ─────────────────────────────────────────────
export const STATUS_CFG: Record<PropertyStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  DISPONIBLE:        { label: PROPERTY_STATUS_LABELS.DISPONIBLE,        color: "text-green-700",  bg: "bg-green-50",  border: "border-green-300",  dot: "bg-green-500" },
  RESERVADO:         { label: PROPERTY_STATUS_LABELS.RESERVADO,         color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-300",   dot: "bg-blue-500" },
  VENDIDO:           { label: PROPERTY_STATUS_LABELS.VENDIDO,           color: "text-red-700",    bg: "bg-red-50",    border: "border-red-300",    dot: "bg-red-500" },
  ALQUILADO:         { label: PROPERTY_STATUS_LABELS.ALQUILADO,         color: "text-red-700",    bg: "bg-red-50",    border: "border-red-300",    dot: "bg-red-500" },
  EN_PREPARACION:    { label: PROPERTY_STATUS_LABELS.EN_PREPARACION,    color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-300", dot: "bg-violet-500" },
  FUERA_DE_CATALOGO: { label: PROPERTY_STATUS_LABELS.FUERA_DE_CATALOGO, color: "text-gray-600",   bg: "bg-gray-100",  border: "border-gray-300",   dot: "bg-gray-400" },
};

const TAG_PALETTE = ["#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2", "#DB2777"];
const CLOSED: PropertyStatus[] = ["VENDIDO", "ALQUILADO", "FUERA_DE_CATALOGO"];

function daysAlert(days: number, status: PropertyStatus) {
  if (CLOSED.includes(status)) return null;
  if (days >= 90) return { label: `${days}d publicada`, cls: "bg-purple-100 text-purple-700 border-purple-300" };
  if (days >= 60) return { label: `${days}d publicada`, cls: "bg-yellow-100 text-yellow-700 border-yellow-300" };
  if (days >= 30) return { label: `${days}d publicada`, cls: "bg-orange-100 text-orange-700 border-orange-300" };
  return null;
}

export function propertyTitle(p: { title: string }) {
  return p.title;
}

export function primaryPhoto(photos: Photo[]) {
  return photos.find((p) => p.isPrimary) ?? photos[0] ?? null;
}

export function priceLabel(p: { priceDOP: number | null; priceUSD: number | null; listingType: ListingType }) {
  const parts = [
    p.priceUSD != null ? formatCurrency(p.priceUSD, "USD") : null,
    p.priceDOP != null ? formatCurrency(p.priceDOP, "DOP") : null,
  ].filter(Boolean);
  if (!parts.length) return "Precio a consultar";
  return parts.join(" · ") + (p.listingType === "ALQUILER" ? " /mes" : "");
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Unique constraint") && msg.includes("sku")) return "Ese código ya está en uso por otra propiedad.";
  if (msg.includes("Unique constraint")) return "Ese valor ya existe en otra propiedad.";
  if (msg.includes("título")) return msg;
  return "Ocurrió un error al guardar. Intenta de nuevo.";
}

const numOrNull = (v: number | "") => (v === "" ? null : Number(v));

// ── KPI Card ──────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, tone = "default" }: {
  icon: React.ElementType; label: string; value: string; tone?: "default" | "green" | "blue" | "purple" | "amber";
}) {
  const tones = {
    default: "text-gray-500 bg-gray-50", green: "text-green-600 bg-green-50", blue: "text-blue-600 bg-blue-50",
    purple: "text-purple-600 bg-purple-50", amber: "text-amber-600 bg-amber-50",
  };
  return (
    <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 flex-1 min-w-[140px]">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", tones[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[16px] font-bold text-gray-900 leading-tight truncate">{value}</p>
        <p className="text-[10.5px] text-gray-400 font-medium truncate">{label}</p>
      </div>
    </div>
  );
}

// ── Status badge (interactive dropdown) ──────────────────
function StatusDropdown({ status, onChange, compact = false }: { status: PropertyStatus; onChange: (s: PropertyStatus) => void; compact?: boolean }) {
  const cfg = STATUS_CFG[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button onClick={(e) => e.stopPropagation()}
          className={cn("flex items-center gap-1.5 border rounded-full font-semibold", cfg.bg, cfg.border, cfg.color, compact ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
          {cfg.label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {PROPERTY_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)} className="text-xs gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_CFG[s].dot)} /> {STATUS_CFG[s].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PropertyActionsMenu({ onViewDetail, onEdit, onDuplicate, onDelete }: {
  onViewDetail: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onViewDetail} className="text-xs gap-2"><FileText className="h-3.5 w-3.5" /> Ver ficha</DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit} className="text-xs gap-2"><Edit2 className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate} className="text-xs gap-2"><Copy className="h-3.5 w-3.5" /> Duplicar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-xs gap-2 text-red-600"><Trash2 className="h-3.5 w-3.5" /> Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Card ──────────────────────────────────────────────────
function PropertyCard({ property, onOpen, onViewDetail, onStatusChange, onEdit, onDuplicate, onDelete }: {
  property: Property; onOpen: () => void; onViewDetail: () => void;
  onStatusChange: (s: PropertyStatus) => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const photo = primaryPhoto(property.photos);
  const alert = daysAlert(property.daysListed, property.status);
  const specs = propertySpecs(property);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      onClick={onOpen}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-md hover:border-gray-300 transition-all">
      <div className="relative aspect-[4/3] bg-gray-100">
        {photo ? (
          <img src={photo.url} alt={property.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center"><Building2 className="h-10 w-10 text-gray-200" /></div>
        )}
        <div className="absolute top-2 left-2"><StatusDropdown status={property.status} onChange={onStatusChange} compact /></div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {property.photos.length > 0 && (
            <span className="flex items-center gap-0.5 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              <ImageIcon className="h-2.5 w-2.5" /> {property.photos.length}
            </span>
          )}
          <div className="bg-white/90 rounded-md">
            <PropertyActionsMenu onViewDetail={onViewDetail} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
          </div>
        </div>
        <span className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 text-gray-700">
          {LISTING_TYPE_LABELS[property.listingType]}
        </span>
        {alert && (
          <span className={cn("absolute bottom-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border", alert.cls)}>{alert.label}</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-[13px] font-bold text-gray-900 truncate">{property.title}</p>
        <p className="text-[11px] text-gray-400 truncate mb-1.5">
          {PROPERTY_TYPE_LABELS[property.propertyType]}{property.projectName ? ` · ${property.projectName}` : ""}
        </p>
        <p className="text-[14px] font-extrabold text-primary mb-1.5 truncate">{priceLabel(property)}</p>
        {specs && (
          <div className="flex items-center gap-2.5 text-[10.5px] text-gray-500 mb-2">
            {property.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {property.bedrooms}</span>}
            {property.bathrooms != null && <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {property.bathrooms}</span>}
            {(property.constructionM2 ?? property.landM2) != null && (
              <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {property.constructionM2 ?? property.landM2} m²</span>
            )}
            {property.parkingSpaces != null && <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {property.parkingSpaces}</span>}
          </div>
        )}
        {property.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {property.tags.slice(0, 3).map((t) => (
              <span key={t.id} className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${t.color}18`, color: t.color }}>{t.name}</span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 text-[10px] text-gray-400 pt-1.5 border-t border-gray-50">
          <MapPin className="h-2.5 w-2.5" /> {propertyLocation(property) || "Sin ubicación"}
        </div>
      </div>
    </motion.div>
  );
}

// ── Confirmaciones ────────────────────────────────────────
function ConfirmModal({ title, body, confirmLabel, danger, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl shadow-xl p-5 w-[380px] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-gray-900 mb-1.5">{title}</h3>
        <p className="text-[12.5px] text-gray-500 mb-4">{body}</p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} className="h-8 text-xs">Cancelar</Button>
          <Button size="sm" onClick={onConfirm} className={cn("h-8 text-xs", danger && "bg-red-600 hover:bg-red-700")}>{confirmLabel}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Formulario (panel lateral) ────────────────────────────
const inputCls = "w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary";
const labelCls = "text-[10px] text-gray-400 block mb-1";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 space-y-3">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder, step }: { value: number | ""; onChange: (v: number | "") => void; placeholder?: string; step?: string }) {
  return (
    <input type="number" min={0} step={step} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />
  );
}

function PropertyPanel({ property, tags, members, onClose }: {
  property: Property | null; tags: VTag[]; members: Member[]; onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!property;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [featureInput, setFeatureInput] = useState("");
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [newPhotos, setNewPhotos] = useState<{ url: string }[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(property?.tags.map((t) => t.id) ?? []);
  const [newTagName, setNewTagName] = useState("");
  const [mapsInput, setMapsInput] = useState("");
  const [mapsBusy, setMapsBusy] = useState(false);
  const [mapsError, setMapsError] = useState("");

  const [form, setForm] = useState({
    title: property?.title ?? "",
    sku: property?.sku ?? "",
    status: (property?.status ?? "DISPONIBLE") as PropertyStatus,
    propertyType: (property?.propertyType ?? "APARTAMENTO") as PropertyType,
    listingType: (property?.listingType ?? "VENTA") as ListingType,
    projectName: property?.projectName ?? "",
    province: property?.province ?? "",
    city: property?.city ?? "",
    sector: property?.sector ?? "",
    address: property?.address ?? "",
    latitude: (property?.latitude ?? "") as number | "",
    longitude: (property?.longitude ?? "") as number | "",
    bedrooms: (property?.bedrooms ?? "") as number | "",
    bathrooms: (property?.bathrooms ?? "") as number | "",
    parkingSpaces: (property?.parkingSpaces ?? "") as number | "",
    constructionM2: (property?.constructionM2 ?? "") as number | "",
    landM2: (property?.landM2 ?? "") as number | "",
    floorNumber: (property?.floorNumber ?? "") as number | "",
    yearBuilt: (property?.yearBuilt ?? "") as number | "",
    furnished: property?.furnished ?? false,
    priceDOP: (property?.priceDOP ?? "") as number | "",
    priceUSD: (property?.priceUSD ?? "") as number | "",
    maintenanceDOP: (property?.maintenanceDOP ?? "") as number | "",
    minimumPrice: (property?.minimumPrice ?? "") as number | "",
    commissionPct: (property?.commissionPct ?? "") as number | "",
    ownerName: property?.ownerName ?? "",
    ownerPhone: property?.ownerPhone ?? "",
    ownerEmail: property?.ownerEmail ?? "",
    capturedById: property?.capturedById ?? "",
    videoUrl: property?.videoUrl ?? "",
    virtualTourUrl: property?.virtualTourUrl ?? "",
    description: property?.description ?? "",
    features: property?.features ?? ([] as string[]),
  });
  const setF = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function handleResolveMaps() {
    setMapsBusy(true); setMapsError("");
    const result = await resolveMapsLink(mapsInput);
    setMapsBusy(false);
    if (!result.ok) { setMapsError(result.error); return; }
    setForm((f) => ({ ...f, latitude: result.latitude, longitude: result.longitude }));
    setMapsInput("");
  }

  function toggleFeature(val: string) {
    setF("features", form.features.includes(val) ? form.features.filter((f) => f !== val) : [...form.features, val]);
  }
  function addFeature() {
    const val = featureInput.trim();
    if (val && !form.features.includes(val)) setF("features", [...form.features, val]);
    setFeatureInput("");
  }

  async function addResolvedPhoto(url: string) {
    if (isEdit && property) {
      await addPropertyPhoto(property.id, url);
      router.refresh();
    } else {
      setNewPhotos((p) => [...p, { url }]);
    }
  }
  async function handleAddPhotoLink() {
    const input = photoUrlInput.trim();
    if (!input) return;
    setPhotoUrlInput(""); setPhotoError(""); setPhotoBusy(true);
    const result = await resolvePhotoUrl(input);
    setPhotoBusy(false);
    if (!result.url) { setPhotoError(result.error ?? "Error desconocido."); return; }
    await addResolvedPhoto(result.url);
  }
  async function handleFileUpload(files: FileList | File[]) {
    setPhotoError(""); setPhotoBusy(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadPropertyPhotoFile(fd);
      if (!result.url) { setPhotoError(result.error ?? "Error desconocido."); continue; }
      await addResolvedPhoto(result.url);
    }
    setPhotoBusy(false);
  }
  function handleDrop(e: DragEvent) {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) handleFileUpload(e.dataTransfer.files);
  }
  async function handleRemovePhoto(photoId: string) { await removePropertyPhoto(photoId); router.refresh(); }
  async function handleSetPrimary(propertyId: string, photoId: string) { await setPrimaryPhoto(propertyId, photoId); router.refresh(); }
  async function handleMovePhoto(photos: Photo[], index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await reorderPropertyPhotos(reordered.map((p) => p.id));
    router.refresh();
  }

  async function handleToggleTag(tagId: string) {
    const next = selectedTagIds.includes(tagId) ? selectedTagIds.filter((id) => id !== tagId) : [...selectedTagIds, tagId];
    setSelectedTagIds(next);
    if (isEdit && property) { await setPropertyTags(property.id, next); router.refresh(); }
  }
  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    setNewTagName("");
    const tag = await createTag(name, TAG_PALETTE[tags.length % TAG_PALETTE.length]);
    const next = [...selectedTagIds, tag.id];
    setSelectedTagIds(next);
    if (isEdit && property) await setPropertyTags(property.id, next);
    router.refresh();
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("El título es obligatorio."); return; }
    setSaving(true); setError("");
    const payload = {
      title: form.title.trim(),
      sku: form.sku || null,
      status: form.status,
      propertyType: form.propertyType,
      listingType: form.listingType,
      projectName: form.projectName || null,
      province: form.province || null,
      city: form.city || null,
      sector: form.sector || null,
      address: form.address || null,
      latitude: numOrNull(form.latitude),
      longitude: numOrNull(form.longitude),
      bedrooms: numOrNull(form.bedrooms),
      bathrooms: numOrNull(form.bathrooms),
      parkingSpaces: numOrNull(form.parkingSpaces),
      constructionM2: numOrNull(form.constructionM2),
      landM2: numOrNull(form.landM2),
      floorNumber: numOrNull(form.floorNumber),
      yearBuilt: numOrNull(form.yearBuilt),
      furnished: form.furnished,
      priceDOP: numOrNull(form.priceDOP),
      priceUSD: numOrNull(form.priceUSD),
      maintenanceDOP: numOrNull(form.maintenanceDOP),
      minimumPrice: numOrNull(form.minimumPrice),
      commissionPct: numOrNull(form.commissionPct),
      ownerName: form.ownerName || null,
      ownerPhone: form.ownerPhone || null,
      ownerEmail: form.ownerEmail || null,
      capturedById: form.capturedById || null,
      videoUrl: form.videoUrl || null,
      virtualTourUrl: form.virtualTourUrl || null,
      description: form.description || null,
      features: form.features,
    };
    try {
      if (isEdit && property) {
        await updateProperty(property.id, payload);
      } else {
        const created = await createProperty(payload, selectedTagIds);
        if (created) for (const p of newPhotos) await addPropertyPhoto(created.id, p.url);
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const photos = property?.photos ?? [];
  const displayPhotos: { id: string; url: string; isPrimary: boolean }[] = isEdit
    ? photos
    : newPhotos.map((p, i) => ({ id: `local-${i}`, url: p.url, isPrimary: i === 0 }));
  const extraFeatures = form.features.filter((f) => !(SUGGESTED_FEATURES as readonly string[]).includes(f));
  const isLand = form.propertyType === "TERRENO";

  return (
    <motion.div className="fixed inset-0 z-40 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <motion.div className="relative w-[480px] max-w-[94vw] bg-white h-full flex flex-col shadow-2xl"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }} onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-[15px] font-bold text-gray-900">{isEdit ? "Editar propiedad" : "Nueva propiedad"}</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Fotos */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Fotos</p>
            {displayPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {displayPhotos.map((p, i) => (
                  <div key={p.id} className={cn("relative aspect-square rounded-lg overflow-hidden border-2 group", p.isPrimary ? "border-primary" : "border-gray-200")}>
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    {p.isPrimary && <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-white text-[8px] font-bold text-center py-0.5">PORTADA</span>}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      {isEdit && property ? (
                        <>
                          {!p.isPrimary && (
                            <button title="Portada" onClick={() => handleSetPrimary(property.id, p.id)} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center"><Star className="h-3 w-3 text-gray-700" /></button>
                          )}
                          <button title="Eliminar" onClick={() => handleRemovePhoto(p.id)} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center"><X className="h-3 w-3 text-red-500" /></button>
                          {i > 0 && <button title="Mover izquierda" onClick={() => handleMovePhoto(photos, i, -1)} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center"><ChevronLeft className="h-3 w-3 text-gray-700" /></button>}
                          {i < photos.length - 1 && <button title="Mover derecha" onClick={() => handleMovePhoto(photos, i, 1)} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center"><ChevronRight className="h-3 w-3 text-gray-700" /></button>}
                        </>
                      ) : (
                        <button title="Eliminar" onClick={() => setNewPhotos((ps) => ps.filter((_, idx) => idx !== i))} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center"><X className="h-3 w-3 text-red-500" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) handleFileUpload(e.target.files); e.target.value = ""; }} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              disabled={photoBusy}
              className={cn("w-full flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-4 transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50", photoBusy && "opacity-60 pointer-events-none")}>
              {photoBusy ? (
                <><Loader2 className="h-5 w-5 text-primary animate-spin" /><span className="text-[11px] text-gray-500">Subiendo…</span></>
              ) : (
                <>
                  <UploadCloud className="h-5 w-5 text-gray-400" />
                  <span className="text-[11px] text-gray-500"><span className="text-primary font-medium">Sube fotos</span> o arrástralas aquí</span>
                  <span className="text-[9.5px] text-gray-300">JPG, PNG o WEBP · máx. 8MB</span>
                </>
              )}
            </button>
            <div className="flex items-center gap-2 my-2.5"><div className="flex-1 h-px bg-gray-100" /><span className="text-[10px] text-gray-300 font-medium">O</span><div className="flex-1 h-px bg-gray-100" /></div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                <input value={photoUrlInput} onChange={(e) => setPhotoUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddPhotoLink(); } }}
                  placeholder="Pegar enlace de un anuncio (Corotos, Encuentra24…)" disabled={photoBusy}
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary disabled:opacity-60" />
              </div>
              <Button size="sm" variant="outline" onClick={handleAddPhotoLink} disabled={photoBusy || !photoUrlInput.trim()} className="h-[30px] px-2.5">
                {photoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {photoError && <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1.5"><AlertTriangle className="h-3 w-3 shrink-0" /> {photoError}</p>}
          </div>

          <Section title="Información básica">
            <div>
              <label className={labelCls}>Título *</label>
              <input value={form.title} onChange={(e) => setF("title", e.target.value)} placeholder="Apartamento 3 hab en Naco con balcón" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Tipo de propiedad</label>
                <select value={form.propertyType} onChange={(e) => setF("propertyType", e.target.value as PropertyType)} className={inputCls}>
                  {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Operación</label>
                <select value={form.listingType} onChange={(e) => setF("listingType", e.target.value as ListingType)} className={inputCls}>
                  {LISTING_TYPES.map((t) => <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.status} onChange={(e) => setF("status", e.target.value as PropertyStatus)} className={inputCls}>
                  {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Código interno</label>
                <input value={form.sku} onChange={(e) => setF("sku", e.target.value)} placeholder="PROP-0042" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Proyecto / torre / residencial</label>
              <input value={form.projectName} onChange={(e) => setF("projectName", e.target.value)} className={inputCls} />
            </div>
          </Section>

          <Section title="Ubicación">
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Provincia</label><input value={form.province} onChange={(e) => setF("province", e.target.value)} placeholder="Distrito Nacional" className={inputCls} /></div>
              <div><label className={labelCls}>Ciudad</label><input value={form.city} onChange={(e) => setF("city", e.target.value)} placeholder="Santo Domingo" className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Sector / zona</label><input value={form.sector} onChange={(e) => setF("sector", e.target.value)} placeholder="Naco, Piantini, Bávaro…" className={inputCls} /></div>
            <div><label className={labelCls}>Dirección (interna)</label><input value={form.address} onChange={(e) => setF("address", e.target.value)} className={inputCls} /></div>
            <div className="space-y-2">
              <label className={labelCls}>Ubicación en el mapa (para enviarla por WhatsApp)</label>
              <div className="flex gap-1.5">
                <input value={mapsInput} onChange={(e) => setMapsInput(e.target.value)} placeholder="Pega un enlace de Google Maps o 18.4861, -69.9312" className={inputCls} />
                <Button size="sm" variant="outline" onClick={handleResolveMaps} disabled={mapsBusy || !mapsInput.trim()} className="h-[30px] px-2.5 shrink-0">
                  {mapsBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Obtener"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>Latitud</label><NumInput value={form.latitude} onChange={(v) => setF("latitude", v)} step="any" /></div>
                <div><label className={labelCls}>Longitud</label><NumInput value={form.longitude} onChange={(v) => setF("longitude", v)} step="any" /></div>
              </div>
              {mapsError && <p className="text-[11px] text-red-500">{mapsError}</p>}
              {form.latitude !== "" && form.longitude !== "" && (
                <a href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">Ver en Google Maps</a>
              )}
            </div>
          </Section>

          <Section title="Características">
            <div className="grid grid-cols-3 gap-2">
              {!isLand && <div><label className={labelCls}>Habitaciones</label><NumInput value={form.bedrooms} onChange={(v) => setF("bedrooms", v)} /></div>}
              {!isLand && <div><label className={labelCls}>Baños</label><NumInput value={form.bathrooms} onChange={(v) => setF("bathrooms", v)} step="0.5" /></div>}
              {!isLand && <div><label className={labelCls}>Parqueos</label><NumInput value={form.parkingSpaces} onChange={(v) => setF("parkingSpaces", v)} /></div>}
              {!isLand && <div><label className={labelCls}>Construcción (m²)</label><NumInput value={form.constructionM2} onChange={(v) => setF("constructionM2", v)} /></div>}
              <div><label className={labelCls}>Terreno (m²)</label><NumInput value={form.landM2} onChange={(v) => setF("landM2", v)} /></div>
              {!isLand && <div><label className={labelCls}>Piso / nivel</label><NumInput value={form.floorNumber} onChange={(v) => setF("floorNumber", v)} /></div>}
              {!isLand && <div><label className={labelCls}>Año construcción</label><NumInput value={form.yearBuilt} onChange={(v) => setF("yearBuilt", v)} /></div>}
            </div>
            {!isLand && (
              <label className="flex items-center gap-2 text-[12px] text-gray-600">
                <input type="checkbox" checked={form.furnished} onChange={(e) => setF("furnished", e.target.checked)} /> Amueblada
              </label>
            )}
          </Section>

          <Section title={form.listingType === "ALQUILER" ? "Renta mensual" : "Precio"}>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Precio RD$</label><NumInput value={form.priceDOP} onChange={(v) => setF("priceDOP", v)} /></div>
              <div><label className={labelCls}>Precio US$</label><NumInput value={form.priceUSD} onChange={(v) => setF("priceUSD", v)} /></div>
              <div><label className={labelCls}>Mantenimiento mensual RD$</label><NumInput value={form.maintenanceDOP} onChange={(v) => setF("maintenanceDOP", v)} /></div>
              <div><label className={labelCls}>Comisión pactada (%)</label><NumInput value={form.commissionPct} onChange={(v) => setF("commissionPct", v)} step="0.1" /></div>
              <div className="col-span-2">
                <label className={labelCls}>Precio mínimo negociable (interno — nunca se publica)</label>
                <NumInput value={form.minimumPrice} onChange={(v) => setF("minimumPrice", v)} />
              </div>
            </div>
          </Section>

          <Section title="Propietario y captación (interno)">
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Propietario</label><input value={form.ownerName} onChange={(e) => setF("ownerName", e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Teléfono</label><input value={form.ownerPhone} onChange={(e) => setF("ownerPhone", e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Correo</label><input type="email" value={form.ownerEmail} onChange={(e) => setF("ownerEmail", e.target.value)} className={inputCls} /></div>
              <div>
                <label className={labelCls}>Captada por</label>
                <select value={form.capturedById} onChange={(e) => setF("capturedById", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          </Section>

          <Section title="Amenidades">
            <div className="flex flex-wrap gap-1.5">
              {[...SUGGESTED_FEATURES, ...extraFeatures].map((f) => {
                const on = form.features.includes(f);
                return (
                  <button key={f} type="button" onClick={() => toggleFeature(f)}
                    className={cn("text-[11px] px-2.5 py-1 rounded-full border transition-colors", on ? "bg-primary/10 border-primary text-primary font-medium" : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
                    {f}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5">
              <input value={featureInput} onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }} placeholder="Otra amenidad…" className={inputCls} />
              <Button size="sm" variant="outline" onClick={addFeature} className="h-[30px] px-2.5"><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </Section>

          <Section title="Descripción y multimedia">
            <textarea value={form.description} onChange={(e) => setF("description", e.target.value)} rows={4}
              placeholder="Detalles adicionales de la propiedad…" className={cn(inputCls, "resize-none")} />
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Video (URL)</label><input value={form.videoUrl} onChange={(e) => setF("videoUrl", e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Tour virtual (URL)</label><input value={form.virtualTourUrl} onChange={(e) => setF("virtualTourUrl", e.target.value)} className={inputCls} /></div>
            </div>
          </Section>

          <Section title="Etiquetas">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const on = selectedTagIds.includes(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => handleToggleTag(t.id)}
                    className={cn("text-[11px] px-2.5 py-1 rounded-full border font-medium", on ? "text-white" : "bg-white")}
                    style={on ? { backgroundColor: t.color, borderColor: t.color } : { color: t.color, borderColor: `${t.color}66` }}>
                    {t.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5">
              <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); } }} placeholder="Nueva etiqueta…" className={inputCls} />
              <Button size="sm" variant="outline" onClick={handleCreateTag} className="h-[30px] px-2.5"><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </Section>

          {isEdit && property && property.priceHistory.length > 0 && (
            <Section title="Historial de precio">
              <div className="space-y-1">
                {property.priceHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-[11.5px] text-gray-600">
                    <span>{new Date(h.createdAt).toLocaleDateString("es-DO")} · {h.note ?? ""}</span>
                    <span className="font-medium">{[h.priceUSD != null ? formatCurrency(h.priceUSD, "USD") : null, h.priceDOP != null ? formatCurrency(h.priceDOP, "DOP") : null].filter(Boolean).join(" · ")}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0 bg-white">
          {error && <p className="text-[11.5px] text-red-500 mb-2">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-[13px]">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 h-9 text-[13px]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Guardar cambios" : "Crear propiedad"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Página ────────────────────────────────────────────────
function computeKpis(list: Property[]): Kpis {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activas = list.filter((p) => p.status === "DISPONIBLE" || p.status === "RESERVADO");
  return {
    total: list.length,
    disponibles: list.filter((p) => p.status === "DISPONIBLE").length,
    reservadas: list.filter((p) => p.status === "RESERVADO").length,
    cerradasMes: list.filter((p) => (p.status === "VENDIDO" || p.status === "ALQUILADO") && p.soldDate && new Date(p.soldDate) >= monthStart).length,
    valorCatalogo: activas.filter((p) => p.listingType !== "ALQUILER").reduce((sum, p) => sum + (p.priceUSD ?? 0), 0),
    avgDias: activas.length ? Math.round(activas.reduce((sum, p) => sum + p.daysListed, 0) / activas.length) : 0,
  };
}

type SortField = "createdAt" | "priceUSD" | "daysListed";

export function InventarioClient({ properties, tags, members }: {
  properties: Property[]; tags: VTag[]; workspaceId: string; members: Member[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<PropertyType | "">("");
  const [listingFilter, setListingFilter] = useState<ListingType | "">("");
  const [cityFilter, setCityFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [panelId, setPanelId] = useState<string | "new" | null>(null);
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [closing, setClosing] = useState<{ property: Property; status: "VENDIDO" | "ALQUILADO" } | null>(null);

  const cities = useMemo(() => Array.from(new Set(properties.map((p) => p.city).filter((c): c is string => !!c))).sort(), [properties]);

  const filtered = useMemo(() => {
    const list = properties.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (typeFilter && p.propertyType !== typeFilter) return false;
      if (listingFilter && p.listingType !== listingFilter) return false;
      if (cityFilter && p.city !== cityFilter) return false;
      if (search) {
        const hay = `${p.title} ${p.sector ?? ""} ${p.city ?? ""} ${p.projectName ?? ""} ${p.sku ?? ""} ${p.ownerName ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      const va = sortField === "priceUSD" ? a.priceUSD ?? 0 : sortField === "daysListed" ? a.daysListed : a.createdAt;
      const vb = sortField === "priceUSD" ? b.priceUSD ?? 0 : sortField === "daysListed" ? b.daysListed : b.createdAt;
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [properties, statusFilter, typeFilter, listingFilter, cityFilter, search, sortField, sortDir]);

  const activeFilters = [statusFilter, typeFilter, listingFilter, cityFilter].filter(Boolean).length;
  const panelProperty = panelId && panelId !== "new" ? properties.find((p) => p.id === panelId) ?? null : null;
  const kpis = computeKpis(filtered);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }
  async function handleStatusChange(p: Property, s: PropertyStatus) {
    if ((s === "VENDIDO" || s === "ALQUILADO") && p.status !== s) { setClosing({ property: p, status: s }); return; }
    await updatePropertyStatus(p.id, s);
    router.refresh();
  }
  async function confirmClose() {
    if (!closing) return;
    await updatePropertyStatus(closing.property.id, closing.status);
    setClosing(null);
    router.refresh();
  }
  async function handleDuplicate(p: Property) { await duplicateProperty(p.id); router.refresh(); }
  async function handleDelete(p: Property) {
    await deleteProperty(p.id);
    setDeleting(null);
    if (panelId === p.id) setPanelId(null);
    router.refresh();
  }

  const selectCls = "h-8 border border-gray-200 rounded-lg bg-white px-2 text-[12px] text-gray-600 outline-none";

  return (
    <div className="flex flex-col h-full bg-[#F5F5F5] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-bold text-gray-900">Catálogo</h1>
          {kpis.total > 0 && (
            <span className="text-[12px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {kpis.total} {kpis.total === 1 ? "propiedad" : "propiedades"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView("grid")} className={cn("h-7 w-7 flex items-center justify-center rounded-md", view === "grid" ? "bg-white shadow-sm text-primary" : "text-gray-400")}><LayoutGrid className="h-3.5 w-3.5" /></button>
            <button onClick={() => setView("list")} className={cn("h-7 w-7 flex items-center justify-center rounded-md", view === "list" ? "bg-white shadow-sm text-primary" : "text-gray-400")}><ListIcon className="h-3.5 w-3.5" /></button>
          </div>
          <Button size="sm" onClick={() => setPanelId("new")} className="h-8 gap-1.5 text-[12px]"><Plus className="h-3.5 w-3.5" /> Agregar propiedad</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <KpiCard icon={Home} label="Disponibles" value={String(kpis.disponibles)} tone="green" />
          <KpiCard icon={Building2} label="Reservadas" value={String(kpis.reservadas)} tone="blue" />
          <KpiCard icon={DollarSign} label="Valor en venta (US$)" value={formatCurrency(kpis.valorCatalogo, "USD")} tone="purple" />
          <KpiCard icon={Star} label="Cerradas este mes" value={String(kpis.cerradasMes)} tone="amber" />
          <KpiCard icon={AlertTriangle} label="Días publicada (prom.)" value={`${kpis.avgDias}d`} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar título, sector, proyecto, propietario…"
              className="h-8 w-[280px] border border-gray-200 rounded-lg bg-white pl-8 pr-2.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PropertyStatus | "")} className={selectCls}>
            <option value="">Todos los estados</option>
            {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as PropertyType | "")} className={selectCls}>
            <option value="">Todos los tipos</option>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>)}
          </select>
          <select value={listingFilter} onChange={(e) => setListingFilter(e.target.value as ListingType | "")} className={selectCls}>
            <option value="">Venta y alquiler</option>
            {LISTING_TYPES.map((t) => <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>)}
          </select>
          {cities.length > 0 && (
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={selectCls}>
              <option value="">Todas las ciudades</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <button onClick={() => toggleSort("priceUSD")} className={cn(selectCls, "flex items-center gap-1")}><ArrowUpDown className="h-3 w-3" /> Precio</button>
          <button onClick={() => toggleSort("daysListed")} className={cn(selectCls, "flex items-center gap-1")}><ArrowUpDown className="h-3 w-3" /> Días</button>
          {activeFilters > 0 && (
            <button onClick={() => { setStatusFilter(""); setTypeFilter(""); setListingFilter(""); setCityFilter(""); }} className="text-[11.5px] text-primary hover:underline">
              Limpiar filtros ({activeFilters})
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-[14px] font-semibold text-gray-700">{properties.length === 0 ? "Aún no tienes propiedades" : "Ninguna propiedad coincide con los filtros"}</p>
            {properties.length === 0 && (
              <>
                <p className="text-[12px] text-gray-400 mb-3">Agrega la primera para que aparezca en tu página web y en las respuestas del agente IA.</p>
                <Button size="sm" onClick={() => setPanelId("new")} className="h-8 gap-1.5 text-[12px]"><Plus className="h-3.5 w-3.5" /> Agregar propiedad</Button>
              </>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            <AnimatePresence>
              {filtered.map((p) => (
                <PropertyCard key={p.id} property={p} onOpen={() => setPanelId(p.id)} onViewDetail={() => router.push(`/inventario/${p.id}`)}
                  onStatusChange={(s) => handleStatusChange(p, s)} onEdit={() => setPanelId(p.id)}
                  onDuplicate={() => handleDuplicate(p)} onDelete={() => setDeleting(p)} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 text-gray-400 text-[10.5px] uppercase tracking-wider">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Propiedad</th>
                  <th className="text-left font-semibold px-3 py-2">Tipo</th>
                  <th className="text-left font-semibold px-3 py-2">Ubicación</th>
                  <th className="text-left font-semibold px-3 py-2">Características</th>
                  <th className="text-left font-semibold px-3 py-2">Precio</th>
                  <th className="text-left font-semibold px-3 py-2">Estado</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => setPanelId(p.id)} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-12 rounded bg-gray-100 overflow-hidden shrink-0">
                          {primaryPhoto(p.photos) && <img src={primaryPhoto(p.photos)!.url} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <span className="font-semibold text-gray-900 truncate max-w-[240px]">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{PROPERTY_TYPE_LABELS[p.propertyType]} · {LISTING_TYPE_LABELS[p.listingType]}</td>
                    <td className="px-3 py-2 text-gray-500">{propertyLocation(p) || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{propertySpecs(p) || "—"}</td>
                    <td className="px-3 py-2 font-semibold text-primary">{priceLabel(p)}</td>
                    <td className="px-3 py-2"><StatusDropdown status={p.status} onChange={(s) => handleStatusChange(p, s)} compact /></td>
                    <td className="px-2">
                      <PropertyActionsMenu onViewDetail={() => router.push(`/inventario/${p.id}`)} onEdit={() => setPanelId(p.id)}
                        onDuplicate={() => handleDuplicate(p)} onDelete={() => setDeleting(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {panelId && <PropertyPanel key={panelId} property={panelProperty} tags={tags} members={members} onClose={() => setPanelId(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {deleting && (
          <ConfirmModal danger title="¿Eliminar propiedad?" confirmLabel="Eliminar"
            body={`“${deleting.title}” se eliminará junto con sus fotos y su historial de precio. Esta acción no se puede deshacer.`}
            onConfirm={() => handleDelete(deleting)} onCancel={() => setDeleting(null)} />
        )}
        {closing && (
          <ConfirmModal title={closing.status === "VENDIDO" ? "¿Marcar como vendida?" : "¿Marcar como alquilada?"} confirmLabel="Confirmar"
            body={`“${closing.property.title}” saldrá del catálogo público. Para registrar la venta completa con comisión, cierra el negocio desde Negocios y Órdenes de Venta.`}
            onConfirm={confirmClose} onCancel={() => setClosing(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
