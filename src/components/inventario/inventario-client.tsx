"use client";

import { useState, useMemo, useRef, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Plus, Search, X, Check, ChevronDown, Star, Copy, Trash2, Edit2,
  MoreHorizontal, Car, Fuel, Gauge, MapPin, Calendar as CalendarIcon,
  Image as ImageIcon, Tag as TagIcon, LayoutGrid, List as ListIcon,
  ArrowUpDown, DollarSign, TrendingUp,
  AlertTriangle, Package, ChevronLeft, ChevronRight,
  Palette, PlayCircle, UploadCloud, Loader2, Link2, FileText,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  createVehicle, updateVehicle, updateVehicleStatus, deleteVehicle, duplicateVehicle,
  addVehiclePhoto, removeVehiclePhoto, setPrimaryPhoto, reorderVehiclePhotos,
  setVehicleTags, createTag,
} from "@/app/actions/vehicles";
import { uploadVehiclePhotoFile, resolvePhotoUrl } from "@/app/actions/storage";

// ── Types ─────────────────────────────────────────────────
type VehicleStatus = "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "EN_PREPARACION" | "FUERA_DE_INVENTARIO";
type Transmission = "AUTOMATICO" | "MANUAL" | "CVT" | "SEMI_AUTO";
type FuelType = "GASOLINA" | "DIESEL" | "HIBRIDO" | "ELECTRICO" | "GAS";
type BodyType = "SEDAN" | "SUV" | "PICKUP" | "HATCHBACK" | "COUPE" | "VAN" | "MINIVAN" | "CONVERTIBLE" | "WAGON";

type Photo = { id: string; url: string; isPrimary: boolean; order: number };
type PriceEntry = { id: string; priceDOP: number | null; priceUSD: number | null; note: string | null; createdAt: string };
type VTag = { id: string; name: string; color: string };

type Vehicle = {
  id: string; sku: string | null; status: VehicleStatus;
  make: string; model: string; year: number; trim: string | null;
  color: string | null; colorHex: string | null; vin: string | null;
  mileage: number | null; transmission: Transmission; fuelType: FuelType;
  bodyType: BodyType | null; engineCC: number | null; doors: number | null;
  priceDOP: number | null; priceUSD: number | null; costDOP: number | null;
  videoUrl: string | null; lotLocation: string | null; daysInLot: number;
  arrivalDate: string | null; soldDate: string | null;
  description: string | null; features: string[];
  photos: Photo[]; tags: VTag[]; priceHistory: PriceEntry[];
  dealsCount: number; leadsCount: number;
  createdAt: string; updatedAt: string;
};

type Kpis = {
  total: number; disponibles: number; reservados: number; vendidosMes: number;
  valorInventario: number; avgDiasEnLote: number; criticos: number;
};

// ── Constants ─────────────────────────────────────────────
export const STATUS_CFG: Record<VehicleStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  DISPONIBLE:          { label: "Disponible",          color: "text-green-700",  bg: "bg-green-50",  border: "border-green-300",  dot: "bg-green-500" },
  RESERVADO:           { label: "Reservado",           color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-300",   dot: "bg-blue-500" },
  VENDIDO:             { label: "Vendido",             color: "text-red-700",    bg: "bg-red-50",    border: "border-red-300",    dot: "bg-red-500" },
  EN_PREPARACION:      { label: "En Preparación",      color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-300", dot: "bg-violet-500" },
  FUERA_DE_INVENTARIO: { label: "Fuera de Inventario", color: "text-gray-600",   bg: "bg-gray-100",  border: "border-gray-300",   dot: "bg-gray-400" },
};

export const TRANS_LABEL: Record<Transmission, string> = { AUTOMATICO: "Automático", MANUAL: "Manual", CVT: "CVT", SEMI_AUTO: "Semi-automático" };
export const FUEL_LABEL: Record<FuelType, string> = { GASOLINA: "Gasolina", DIESEL: "Diésel", HIBRIDO: "Híbrido", ELECTRICO: "Eléctrico", GAS: "Gas" };
export const BODY_LABEL: Record<BodyType, string> = { SEDAN: "Sedán", SUV: "SUV", PICKUP: "Pickup", HATCHBACK: "Hatchback", COUPE: "Coupé", VAN: "Van", MINIVAN: "Minivan", CONVERTIBLE: "Convertible", WAGON: "Wagon" };

const TAG_PALETTE = ["#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2", "#DB2777"];

function daysAlert(days: number, status: VehicleStatus) {
  if (status === "VENDIDO" || status === "FUERA_DE_INVENTARIO") return null;
  if (days >= 60) return { label: `${days}d en lote`, cls: "bg-purple-100 text-purple-700 border-purple-300" };
  if (days >= 45) return { label: `${days}d en lote`, cls: "bg-yellow-100 text-yellow-700 border-yellow-300" };
  if (days >= 30) return { label: `${days}d en lote`, cls: "bg-orange-100 text-orange-700 border-orange-300" };
  return null;
}

export function vehicleTitle(v: { make: string; model: string; year: number }) {
  return `${v.make} ${v.model} ${v.year}`;
}

export function primaryPhoto(photos: Photo[]) {
  return photos.find((p) => p.isPrimary) ?? photos[0] ?? null;
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Unique constraint") && msg.includes("vin")) return "Ese VIN ya está registrado en otro vehículo.";
  if (msg.includes("Unique constraint") && msg.includes("sku")) return "Ese SKU ya está en uso por otro vehículo.";
  if (msg.includes("Unique constraint")) return "Ese valor ya existe en otro vehículo.";
  return "Ocurrió un error al guardar. Intenta de nuevo.";
}

// ── KPI Card ──────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, tone = "default" }: {
  icon: React.ElementType; label: string; value: string; tone?: "default" | "green" | "blue" | "purple" | "amber";
}) {
  const tones = {
    default: "text-gray-500 bg-gray-50",
    green:   "text-green-600 bg-green-50",
    blue:    "text-blue-600 bg-blue-50",
    purple:  "text-purple-600 bg-purple-50",
    amber:   "text-amber-600 bg-amber-50",
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
function StatusDropdown({ status, onChange, compact = false }: { status: VehicleStatus; onChange: (s: VehicleStatus) => void; compact?: boolean }) {
  const cfg = STATUS_CFG[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button onClick={(e) => e.stopPropagation()}
          className={cn("flex items-center gap-1.5 rounded-full border font-semibold transition-opacity hover:opacity-80",
            cfg.bg, cfg.border, cfg.color, compact ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
          {cfg.label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {(Object.keys(STATUS_CFG) as VehicleStatus[]).map((s) => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)} className="text-xs gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_CFG[s].dot)} />
            {STATUS_CFG[s].label}
            {status === s && <Check className="h-3 w-3 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Actions menu (shared grid/list) ──────────────────────
function VehicleActionsMenu({ onViewDetail, onEdit, onDuplicate, onDelete }: {
  onViewDetail: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button onClick={(e) => e.stopPropagation()}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onViewDetail} className="text-xs gap-2"><FileText className="h-3.5 w-3.5" /> Ver ficha (conduces)</DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit} className="text-xs gap-2"><Edit2 className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate} className="text-xs gap-2"><Copy className="h-3.5 w-3.5" /> Duplicar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-xs gap-2 text-red-500 focus:text-red-600"><Trash2 className="h-3.5 w-3.5" /> Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Vehicle Card (grid) ───────────────────────────────────
function VehicleCard({ vehicle, onOpen, onViewDetail, onStatusChange, onEdit, onDuplicate, onDelete }: {
  vehicle: Vehicle; onOpen: () => void; onViewDetail: () => void;
  onStatusChange: (s: VehicleStatus) => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const photo = primaryPhoto(vehicle.photos);
  const alert = daysAlert(vehicle.daysInLot, vehicle.status);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      onClick={onOpen}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group">
      <div className="relative aspect-[4/3] bg-gray-100">
        {photo ? (
          <img src={photo.url} alt={vehicleTitle(vehicle)} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Car className="h-10 w-10 text-gray-200" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StatusDropdown status={vehicle.status} onChange={onStatusChange} compact />
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {vehicle.photos.length > 0 && (
            <span className="flex items-center gap-0.5 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              <ImageIcon className="h-2.5 w-2.5" /> {vehicle.photos.length}
            </span>
          )}
          <div className="bg-white/90 rounded-md">
            <VehicleActionsMenu onViewDetail={onViewDetail} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
          </div>
        </div>
        {alert && (
          <span className={cn("absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border", alert.cls)}>
            {alert.label}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-[13px] font-bold text-gray-900 truncate">{vehicleTitle(vehicle)}</p>
        <p className="text-[11px] text-gray-400 truncate mb-1.5">
          {[vehicle.trim, vehicle.color].filter(Boolean).join(" · ") || "—"}
        </p>
        <p className="text-[15px] font-extrabold text-primary mb-1.5">
          {vehicle.priceDOP != null ? formatCurrency(vehicle.priceDOP, "DOP") : "Precio a consultar"}
        </p>
        <div className="flex items-center gap-2.5 text-[10.5px] text-gray-500 mb-2">
          <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> {(vehicle.mileage ?? 0).toLocaleString("es-DO")} km</span>
          <span className="flex items-center gap-1"><Fuel className="h-3 w-3" /> {FUEL_LABEL[vehicle.fuelType]}</span>
        </div>
        {vehicle.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {vehicle.tags.slice(0, 3).map((t) => (
              <span key={t.id} className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${t.color}18`, color: t.color }}>
                {t.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 text-[10px] text-gray-400 pt-1.5 border-t border-gray-50">
          <MapPin className="h-2.5 w-2.5" /> {vehicle.lotLocation || "Sin ubicación"}
        </div>
      </div>
    </motion.div>
  );
}

// ── Delete Confirm ────────────────────────────────────────
function DeleteConfirm({ vehicle, onConfirm, onCancel }: { vehicle: Vehicle; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div className="bg-white rounded-2xl shadow-2xl p-6 w-[380px]"
        initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Eliminar vehículo</h3>
        <p className="text-[13px] text-gray-500 mb-5">
          ¿Eliminar <span className="font-medium text-gray-800">{vehicleTitle(vehicle)}</span>? Se borrarán sus fotos e historial de precio. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">Cancelar</Button>
          <Button size="sm" onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 border-red-600">Eliminar</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Sell Confirm ──────────────────────────────────────────
function SellConfirm({ vehicle, onConfirm, onCancel }: { vehicle: Vehicle; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div className="bg-white rounded-2xl shadow-2xl p-6 w-[380px]"
        initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Marcar como vendido</h3>
        <p className="text-[13px] text-gray-500 mb-5">
          <span className="font-medium text-gray-800">{vehicleTitle(vehicle)}</span> pasará a Vendido y saldrá del inventario activo.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">Cancelar</Button>
          <Button size="sm" onClick={onConfirm} className="flex-1">Confirmar venta</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Vehicle Panel (right slide-in, create/edit) ──────────
function VehiclePanel({ vehicle, tags, workspaceId, onClose }: {
  vehicle: Vehicle | null; tags: VTag[]; workspaceId: string; onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!vehicle;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [featureInput, setFeatureInput] = useState("");
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [newPhotos, setNewPhotos] = useState<{ url: string }[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(vehicle?.tags.map((t) => t.id) ?? []);
  const [newTagName, setNewTagName] = useState("");

  const [form, setForm] = useState({
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    year: vehicle?.year ?? new Date().getFullYear(),
    trim: vehicle?.trim ?? "",
    color: vehicle?.color ?? "",
    colorHex: vehicle?.colorHex ?? "#2563EB",
    vin: vehicle?.vin ?? "",
    sku: vehicle?.sku ?? "",
    mileage: (vehicle?.mileage ?? 0) as number | "",
    transmission: (vehicle?.transmission ?? "AUTOMATICO") as Transmission,
    fuelType: (vehicle?.fuelType ?? "GASOLINA") as FuelType,
    bodyType: (vehicle?.bodyType ?? "") as BodyType | "",
    engineCC: vehicle?.engineCC ?? ("" as number | ""),
    doors: (vehicle?.doors ?? 4) as number | "",
    priceDOP: vehicle?.priceDOP ?? ("" as number | ""),
    priceUSD: vehicle?.priceUSD ?? ("" as number | ""),
    costDOP: vehicle?.costDOP ?? ("" as number | ""),
    videoUrl: vehicle?.videoUrl ?? "",
    lotLocation: vehicle?.lotLocation ?? "",
    arrivalDate: vehicle?.arrivalDate ? vehicle.arrivalDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    status: (vehicle?.status ?? "DISPONIBLE") as VehicleStatus,
    description: vehicle?.description ?? "",
    features: vehicle?.features ?? [] as string[],
  });

  const setF = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function addFeature() {
    const val = featureInput.trim();
    if (val && !form.features.includes(val)) setF("features", [...form.features, val]);
    setFeatureInput("");
  }
  function removeFeature(val: string) {
    setF("features", form.features.filter((f) => f !== val));
  }

  async function addResolvedPhoto(url: string) {
    if (isEdit && vehicle) {
      await addVehiclePhoto(vehicle.id, url);
      router.refresh();
    } else {
      setNewPhotos((p) => [...p, { url }]);
    }
  }

  async function handleAddPhotoLink() {
    const input = photoUrlInput.trim();
    if (!input) return;
    setPhotoUrlInput("");
    setPhotoError("");
    setPhotoBusy(true);
    const result = await resolvePhotoUrl(input);
    setPhotoBusy(false);
    if (!result.url) { setPhotoError(result.error ?? "Error desconocido."); return; }
    await addResolvedPhoto(result.url);
  }

  async function handleFileUpload(files: FileList | File[]) {
    setPhotoError("");
    setPhotoBusy(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadVehiclePhotoFile(fd);
      if (!result.url) { setPhotoError(result.error ?? "Error desconocido."); continue; }
      await addResolvedPhoto(result.url);
    }
    setPhotoBusy(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFileUpload(e.dataTransfer.files);
  }

  async function handleRemovePhoto(photoId: string) {
    await removeVehiclePhoto(photoId);
    router.refresh();
  }
  async function handleSetPrimary(vehicleId: string, photoId: string) {
    await setPrimaryPhoto(vehicleId, photoId);
    router.refresh();
  }
  async function handleMovePhoto(photos: Photo[], index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await reorderVehiclePhotos(reordered.map((p) => p.id));
    router.refresh();
  }

  function toggleLocalTag(tagId: string) {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }
  async function handleToggleTag(tagId: string) {
    if (isEdit && vehicle) {
      const next = selectedTagIds.includes(tagId) ? selectedTagIds.filter((id) => id !== tagId) : [...selectedTagIds, tagId];
      setSelectedTagIds(next);
      await setVehicleTags(vehicle.id, next);
      router.refresh();
    } else {
      toggleLocalTag(tagId);
    }
  }
  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    setNewTagName("");
    const tag = await createTag(workspaceId, name, TAG_PALETTE[tags.length % TAG_PALETTE.length]);
    if (tag) {
      if (isEdit && vehicle) {
        const next = [...selectedTagIds, tag.id];
        setSelectedTagIds(next);
        await setVehicleTags(vehicle.id, next);
      } else {
        toggleLocalTag(tag.id);
      }
      router.refresh();
    }
  }

  async function handleSave() {
    if (!form.make.trim() || !form.model.trim()) { setError("Marca y modelo son obligatorios."); return; }
    setSaving(true);
    setError("");
    const payload = {
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      trim: form.trim || null,
      color: form.color || null,
      colorHex: form.colorHex || null,
      vin: form.vin || null,
      sku: form.sku || null,
      mileage: form.mileage === "" ? 0 : Number(form.mileage),
      transmission: form.transmission,
      fuelType: form.fuelType,
      bodyType: form.bodyType || null,
      engineCC: form.engineCC === "" ? null : Number(form.engineCC),
      doors: form.doors === "" ? 4 : Number(form.doors),
      priceDOP: form.priceDOP === "" ? null : Number(form.priceDOP),
      priceUSD: form.priceUSD === "" ? null : Number(form.priceUSD),
      costDOP: form.costDOP === "" ? null : Number(form.costDOP),
      videoUrl: form.videoUrl || null,
      lotLocation: form.lotLocation || null,
      arrivalDate: form.arrivalDate || null,
      status: form.status,
      description: form.description || null,
      features: form.features,
    };
    try {
      if (isEdit && vehicle) {
        await updateVehicle(vehicle.id, payload);
      } else {
        const created = await createVehicle(workspaceId, payload, selectedTagIds);
        if (created) {
          for (const p of newPhotos) await addVehiclePhoto(created.id, p.url);
        }
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const photos = vehicle?.photos ?? [];
  const displayPhotos: { id: string; url: string; isPrimary: boolean }[] = isEdit
    ? photos
    : newPhotos.map((p, i) => ({ id: `local-${i}`, url: p.url, isPrimary: i === 0 }));

  return (
    <motion.div className="fixed inset-0 z-40 flex justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <motion.div className="relative w-[460px] max-w-[92vw] bg-white h-full flex flex-col shadow-2xl"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-[15px] font-bold text-gray-900">{isEdit ? "Editar vehículo" : "Nuevo vehículo"}</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Photos */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> Fotos
            </p>
            {displayPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {displayPhotos.map((p, i) => (
                  <div key={p.id} className={cn("relative aspect-square rounded-lg overflow-hidden border-2 group", p.isPrimary ? "border-primary" : "border-gray-200")}>
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    {p.isPrimary && (
                      <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-white text-[8px] font-bold text-center py-0.5">PORTADA</span>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      {isEdit && vehicle && (
                        <>
                          {!p.isPrimary && (
                            <button title="Portada" onClick={() => handleSetPrimary(vehicle.id, p.id)} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center hover:bg-white">
                              <Star className="h-3 w-3 text-gray-700" />
                            </button>
                          )}
                          <button title="Eliminar" onClick={() => handleRemovePhoto(p.id)} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center hover:bg-white">
                            <X className="h-3 w-3 text-red-500" />
                          </button>
                          {i > 0 && (
                            <button title="Mover izquierda" onClick={() => handleMovePhoto(photos, i, -1)} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center hover:bg-white">
                              <ChevronLeft className="h-3 w-3 text-gray-700" />
                            </button>
                          )}
                          {i < photos.length - 1 && (
                            <button title="Mover derecha" onClick={() => handleMovePhoto(photos, i, 1)} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center hover:bg-white">
                              <ChevronRight className="h-3 w-3 text-gray-700" />
                            </button>
                          )}
                        </>
                      )}
                      {!isEdit && (
                        <button title="Eliminar" onClick={() => setNewPhotos((ps) => ps.filter((_, idx) => idx !== i))} className="h-5 w-5 rounded bg-white/90 flex items-center justify-center hover:bg-white">
                          <X className="h-3 w-3 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dropzone / subir desde el dispositivo */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) handleFileUpload(e.target.files); e.target.value = ""; }} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              disabled={photoBusy}
              className={cn("w-full flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-4 transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                photoBusy && "opacity-60 pointer-events-none")}>
              {photoBusy ? (
                <>
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  <span className="text-[11px] text-gray-500">Subiendo…</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-5 w-5 text-gray-400" />
                  <span className="text-[11px] text-gray-500">
                    <span className="text-primary font-medium">Sube fotos</span> o arrástralas aquí
                  </span>
                  <span className="text-[9.5px] text-gray-300">JPG, PNG o WEBP · máx. 8MB</span>
                </>
              )}
            </button>

            {/* Separador */}
            <div className="flex items-center gap-2 my-2.5">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-300 font-medium">O</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Enlace de un anuncio */}
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                <input value={photoUrlInput} onChange={(e) => setPhotoUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddPhotoLink(); } }}
                  placeholder="Pegar enlace de un anuncio (Supercarros, Encuentra24…)"
                  disabled={photoBusy}
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary disabled:opacity-60" />
              </div>
              <Button size="sm" variant="outline" onClick={handleAddPhotoLink} disabled={photoBusy || !photoUrlInput.trim()} className="h-[30px] px-2.5">
                {photoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-[9.5px] text-gray-300 mt-1">Extraemos la foto principal del anuncio automáticamente.</p>

            {photoError && (
              <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {photoError}
              </p>
            )}
          </div>

          {/* Basic info */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Información básica</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Marca *</label>
                <input value={form.make} onChange={(e) => setF("make", e.target.value)} placeholder="Toyota"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Modelo *</label>
                <input value={form.model} onChange={(e) => setF("model", e.target.value)} placeholder="Corolla"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Año *</label>
                <input type="number" value={form.year} onChange={(e) => setF("year", Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Versión / Trim</label>
                <input value={form.trim} onChange={(e) => setF("trim", e.target.value)} placeholder="LE, XLE, Sport…"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Color</label>
                <input value={form.color} onChange={(e) => setF("color", e.target.value)} placeholder="Blanco perla"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1 flex items-center gap-1"><Palette className="h-2.5 w-2.5" /> Tono</label>
                <input type="color" value={form.colorHex} onChange={(e) => setF("colorHex", e.target.value)}
                  className="w-full h-[30px] border border-gray-200 rounded-lg cursor-pointer" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Estado del vehículo</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn("flex items-center gap-2 border rounded-lg px-2.5 py-1.5 text-[12px] w-full", STATUS_CFG[form.status].bg, STATUS_CFG[form.status].border, STATUS_CFG[form.status].color)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_CFG[form.status].dot)} />
                    {STATUS_CFG[form.status].label}
                    <ChevronDown className="h-3 w-3 ml-auto opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {(Object.keys(STATUS_CFG) as VehicleStatus[]).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setF("status", s)} className="text-xs gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_CFG[s].dot)} />
                      {STATUS_CFG[s].label}
                      {form.status === s && <Check className="h-3 w-3 ml-auto text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Pricing */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Precios
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Precio DOP</label>
                <input type="number" value={form.priceDOP} onChange={(e) => setF("priceDOP", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Precio USD</label>
                <input type="number" value={form.priceUSD} onChange={(e) => setF("priceUSD", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Costo DOP (interno)</label>
              <input type="number" value={form.costDOP} onChange={(e) => setF("costDOP", e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>

            {isEdit && vehicle && vehicle.priceHistory.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] text-gray-400 mb-1.5">Historial de precio</p>
                <div className="space-y-1 max-h-[110px] overflow-y-auto">
                  {vehicle.priceHistory.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-[11px] bg-gray-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-gray-600">
                        {p.priceDOP != null ? formatCurrency(p.priceDOP, "DOP") : "—"}
                        {p.priceUSD != null && <span className="text-gray-400"> · {formatCurrency(p.priceUSD, "USD")}</span>}
                      </span>
                      <span className="text-gray-400">{new Date(p.createdAt).toLocaleDateString("es-DO", { day: "numeric", month: "short" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Specs */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Gauge className="h-3 w-3" /> Especificaciones
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">VIN</label>
                <input value={form.vin} onChange={(e) => setF("vin", e.target.value.toUpperCase())} placeholder="1HGBH41JXMN109186"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">SKU</label>
                <input value={form.sku} onChange={(e) => setF("sku", e.target.value)} placeholder="PROP-0042"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Kilometraje</label>
                <input type="number" value={form.mileage} onChange={(e) => setF("mileage", e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Motor (CC)</label>
                <input type="number" value={form.engineCC} onChange={(e) => setF("engineCC", e.target.value === "" ? "" : Number(e.target.value))} placeholder="2000"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Puertas</label>
                <input type="number" value={form.doors} onChange={(e) => setF("doors", e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Carrocería</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-left">
                      {form.bodyType ? BODY_LABEL[form.bodyType] : <span className="text-gray-300">Seleccionar…</span>}
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(Object.keys(BODY_LABEL) as BodyType[]).map((b) => (
                      <DropdownMenuItem key={b} onClick={() => setF("bodyType", b)} className="text-xs">{BODY_LABEL[b]}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Transmisión</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px]">
                      {TRANS_LABEL[form.transmission]}
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(Object.keys(TRANS_LABEL) as Transmission[]).map((t) => (
                      <DropdownMenuItem key={t} onClick={() => setF("transmission", t)} className="text-xs">{TRANS_LABEL[t]}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Combustible</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px]">
                      {FUEL_LABEL[form.fuelType]}
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(Object.keys(FUEL_LABEL) as FuelType[]).map((f) => (
                      <DropdownMenuItem key={f} onClick={() => setF("fuelType", f)} className="text-xs">{FUEL_LABEL[f]}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1 flex items-center gap-1"><PlayCircle className="h-2.5 w-2.5" /> URL de video</label>
              <input value={form.videoUrl} onChange={(e) => setF("videoUrl", e.target.value)} placeholder="https://…"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          {/* Inventory */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Inventario
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Ubicación en lote</label>
                <input value={form.lotLocation} onChange={(e) => setF("lotLocation", e.target.value)} placeholder="Patio A - Fila 3"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Fecha de llegada</label>
                <input type="date" value={form.arrivalDate} onChange={(e) => setF("arrivalDate", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            {isEdit && vehicle && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">
                <CalendarIcon className="h-3 w-3" /> {vehicle.daysInLot} días en lote
                {vehicle.dealsCount > 0 && <span className="text-gray-400">· {vehicle.dealsCount} negocio{vehicle.dealsCount !== 1 ? "s" : ""} asociado{vehicle.dealsCount !== 1 ? "s" : ""}</span>}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Descripción</p>
            <textarea value={form.description} onChange={(e) => setF("description", e.target.value)}
              rows={3} placeholder="Detalles adicionales del vehículo…"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          {/* Features */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Características</p>
            {form.features.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.features.map((f) => (
                  <span key={f} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-[11px] font-medium px-2 py-1 rounded-full">
                    {f}
                    <button onClick={() => removeFeature(f)} className="hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
            <input value={featureInput} onChange={(e) => setFeatureInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addFeature(); } }}
              placeholder="Escribe y presiona Enter (A/C, Sunroof, Cámara reversa…)"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
          </div>

          {/* Tags */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <TagIcon className="h-3 w-3" /> Etiquetas
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => {
                const active = selectedTagIds.includes(t.id);
                return (
                  <button key={t.id} onClick={() => handleToggleTag(t.id)}
                    className={cn("text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all")}
                    style={active ? { backgroundColor: `${t.color}18`, borderColor: t.color, color: t.color } : { borderColor: "#e5e7eb", color: "#9ca3af" }}>
                    {t.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5">
              <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); } }}
                placeholder="+ Nueva etiqueta…"
                className="flex-1 border border-dashed border-gray-300 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-100">
            <p className="text-[11px] text-red-600 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> {error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-100 bg-white shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button size="sm" disabled={!form.make.trim() || !form.model.trim() || saving} onClick={handleSave} className="flex-1">
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear vehículo"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main InventarioClient ─────────────────────────────────
function computeKpis(list: Vehicle[]): Kpis {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activos = list.filter((v) => v.status === "DISPONIBLE" || v.status === "RESERVADO");
  return {
    total: list.length,
    disponibles: list.filter((v) => v.status === "DISPONIBLE").length,
    reservados: list.filter((v) => v.status === "RESERVADO").length,
    vendidosMes: list.filter((v) => v.status === "VENDIDO" && v.soldDate && new Date(v.soldDate) >= monthStart).length,
    valorInventario: activos.reduce((sum, v) => sum + (v.priceDOP ?? 0), 0),
    avgDiasEnLote: activos.length ? Math.round(activos.reduce((sum, v) => sum + v.daysInLot, 0) / activos.length) : 0,
    criticos: activos.filter((v) => v.daysInLot >= 60).length,
  };
}

export function InventarioClient({ vehicles, tags, workspaceId }: {
  vehicles: Vehicle[]; tags: VTag[]; workspaceId: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "">("");
  const [makeFilter, setMakeFilter] = useState("");
  const [bodyFilter, setBodyFilter] = useState<BodyType | "">("");
  const [daysFilter, setDaysFilter] = useState<"" | "30" | "45" | "60">("");
  const [sortField, setSortField] = useState<"createdAt" | "priceDOP" | "year" | "daysInLot">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [panelId, setPanelId] = useState<string | "new" | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [selling, setSelling] = useState<Vehicle | null>(null);

  const makes = useMemo(() => Array.from(new Set(vehicles.map((v) => v.make))).sort(), [vehicles]);

  let filtered = vehicles.filter((v) => {
    if (statusFilter && v.status !== statusFilter) return false;
    if (makeFilter && v.make !== makeFilter) return false;
    if (bodyFilter && v.bodyType !== bodyFilter) return false;
    if (daysFilter && v.daysInLot < Number(daysFilter)) return false;
    if (dateFrom || dateTo) {
      if (!v.arrivalDate) return false;
      const arrival = v.arrivalDate.slice(0, 10);
      if (dateFrom && arrival < dateFrom) return false;
      if (dateTo && arrival > dateTo) return false;
    }
    if (search) {
      const hay = `${v.make} ${v.model} ${v.year} ${v.trim ?? ""} ${v.vin ?? ""} ${v.sku ?? ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    let va: number | string, vb: number | string;
    if (sortField === "priceDOP") { va = a.priceDOP ?? 0; vb = b.priceDOP ?? 0; }
    else if (sortField === "year") { va = a.year; vb = b.year; }
    else if (sortField === "daysInLot") { va = a.daysInLot; vb = b.daysInLot; }
    else { va = a.createdAt; vb = b.createdAt; }
    return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const activeFilters = [statusFilter, makeFilter, bodyFilter, daysFilter, dateFrom, dateTo].filter(Boolean).length;
  const panelVehicle = panelId && panelId !== "new" ? vehicles.find((v) => v.id === panelId) ?? null : null;
  const kpis = computeKpis(filtered);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  async function handleStatusChange(v: Vehicle, s: VehicleStatus) {
    if (s === "VENDIDO" && v.status !== "VENDIDO") { setSelling(v); return; }
    await updateVehicleStatus(v.id, s);
    router.refresh();
  }
  async function confirmSell() {
    if (!selling) return;
    await updateVehicleStatus(selling.id, "VENDIDO");
    setSelling(null);
    router.refresh();
  }
  async function handleDuplicate(v: Vehicle) {
    await duplicateVehicle(v.id);
    router.refresh();
  }
  async function handleDelete(v: Vehicle) {
    await deleteVehicle(v.id);
    setDeleting(null);
    if (panelId === v.id) setPanelId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col h-full bg-[#F5F5F5] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-bold text-gray-900">Inventario</h1>
          {kpis.total > 0 && (
            <span className="text-[12px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {kpis.total} {kpis.total === 1 ? "vehículo" : "vehículos"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView("grid")} className={cn("h-7 w-7 flex items-center justify-center rounded-md transition-colors", view === "grid" ? "bg-white shadow-sm text-primary" : "text-gray-400")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView("list")} className={cn("h-7 w-7 flex items-center justify-center rounded-md transition-colors", view === "list" ? "bg-white shadow-sm text-primary" : "text-gray-400")}>
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button size="sm" onClick={() => setPanelId("new")} className="h-8 gap-1.5 text-[12px]">
            <Plus className="h-3.5 w-3.5" /> Agregar vehículo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex items-center gap-2.5 px-6 py-3 bg-white border-b border-gray-100 shrink-0 overflow-x-auto">
        <KpiCard icon={DollarSign} label="Valor de inventario" value={formatCurrency(kpis.valorInventario, "DOP")} />
        <KpiCard icon={Package} label="Total inventario" value={String(kpis.total)} />
        <KpiCard icon={Check} label="Disponibles" value={String(kpis.disponibles)} tone="green" />
        <KpiCard icon={CalendarIcon} label="Reservados" value={String(kpis.reservados)} tone="blue" />
        <KpiCard icon={TrendingUp} label="Vendidos este mes" value={String(kpis.vendidosMes)} tone="purple" />
        <KpiCard icon={Gauge} label="Días promedio en lote" value={String(kpis.avgDiasEnLote)} />
        <KpiCard icon={AlertTriangle} label="Críticos (60+ días)" value={String(kpis.criticos)} tone="amber" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-gray-100 shrink-0 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 hover:bg-gray-50", statusFilter ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600")}>
              Estado: {statusFilter ? STATUS_CFG[statusFilter].label : "Todos"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setStatusFilter("")} className="text-xs">Todos</DropdownMenuItem>
            <DropdownMenuSeparator />
            {(Object.keys(STATUS_CFG) as VehicleStatus[]).map((s) => (
              <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)} className="text-xs gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_CFG[s].dot)} />
                {STATUS_CFG[s].label}
                {statusFilter === s && <Check className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 hover:bg-gray-50", makeFilter ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600")}>
              Marca: {makeFilter || "Todas"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            <DropdownMenuItem onClick={() => setMakeFilter("")} className="text-xs">Todas</DropdownMenuItem>
            <DropdownMenuSeparator />
            {makes.map((m) => (
              <DropdownMenuItem key={m} onClick={() => setMakeFilter(m)} className="text-xs justify-between">
                {m}
                {makeFilter === m && <Check className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 hover:bg-gray-50", bodyFilter ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600")}>
              Carrocería: {bodyFilter ? BODY_LABEL[bodyFilter] : "Todas"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setBodyFilter("")} className="text-xs">Todas</DropdownMenuItem>
            <DropdownMenuSeparator />
            {(Object.keys(BODY_LABEL) as BodyType[]).map((b) => (
              <DropdownMenuItem key={b} onClick={() => setBodyFilter(b)} className="text-xs justify-between">
                {BODY_LABEL[b]}
                {bodyFilter === b && <Check className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 hover:bg-gray-50", daysFilter ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600")}>
              <AlertTriangle className="h-3.5 w-3.5" />
              Días en lote: {daysFilter ? `${daysFilter}+` : "Todos"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {[["", "Todos"], ["30", "30+ (atención)"], ["45", "45+ (espera)"], ["60", "60+ (crítico)"]].map(([v, l]) => (
              <DropdownMenuItem key={v} onClick={() => setDaysFilter(v as typeof daysFilter)} className="text-xs">
                {l}
                {daysFilter === v && <Check className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 text-[12px] border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50">
              <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {([["createdAt", "Más reciente"], ["priceDOP", "Precio"], ["year", "Año"], ["daysInLot", "Días en lote"]] as [typeof sortField, string][]).map(([f, l]) => (
              <DropdownMenuItem key={f} onClick={() => toggleSort(f)} className="text-xs justify-between">
                {l}
                {sortField === f && <span className="text-primary text-[10px] ml-2">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-1.5 text-[12px] border rounded-lg px-3 py-1.5 hover:bg-gray-50", (dateFrom || dateTo) ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              Llegada: {dateFrom || dateTo
                ? `${dateFrom ? new Date(dateFrom + "T00:00:00").toLocaleDateString("es-DO", { day: "numeric", month: "short" }) : "…"} – ${dateTo ? new Date(dateTo + "T00:00:00").toLocaleDateString("es-DO", { day: "numeric", month: "short" }) : "…"}`
                : "Todas"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60 p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Fecha de llegada</p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Desde</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Hasta</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-primary" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-1">
                  <X className="h-3 w-3" /> Limpiar fecha
                </button>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {activeFilters > 0 && (
          <button onClick={() => { setStatusFilter(""); setMakeFilter(""); setBodyFilter(""); setDaysFilter(""); setDateFrom(""); setDateTo(""); }}
            className="text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-1">
            <X className="h-3 w-3" /> Limpiar ({activeFilters})
          </button>
        )}

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar marca, modelo, VIN, SKU…"
            className="pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary bg-white w-[220px]" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Car className="h-12 w-12 opacity-15" />
            <p className="text-[14px] font-medium text-gray-400">{vehicles.length === 0 ? "Sin vehículos en inventario" : "Ningún vehículo coincide con los filtros"}</p>
            {vehicles.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => setPanelId("new")}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar primer vehículo
              </Button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            <AnimatePresence>
              {filtered.map((v) => (
                <VehicleCard key={v.id} vehicle={v}
                  onOpen={() => setPanelId(v.id)}
                  onViewDetail={() => router.push(`/inventario/${v.id}`)}
                  onStatusChange={(s) => handleStatusChange(v, s)}
                  onEdit={() => setPanelId(v.id)}
                  onDuplicate={() => handleDuplicate(v)}
                  onDelete={() => setDeleting(v)} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="w-14 py-2.5 px-3"></th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Vehículo</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">VIN / SKU</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Estado</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Precio</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Kilometraje</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Días en lote</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-3">Ubicación</th>
                  <th className="text-left text-[11px] font-semibold text-gray-500 py-2.5 pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const photo = primaryPhoto(v.photos);
                  const alert = daysAlert(v.daysInLot, v.status);
                  return (
                    <tr key={v.id} onClick={() => setPanelId(v.id)} className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer group">
                      <td className="py-2 px-3">
                        <div className="h-10 w-14 rounded-md bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                          {photo ? <img src={photo.url} alt="" className="h-full w-full object-cover" /> : <Car className="h-4 w-4 text-gray-300" />}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <p className="font-semibold text-gray-900">{vehicleTitle(v)}</p>
                        <p className="text-[10.5px] text-gray-400">{[v.trim, v.color].filter(Boolean).join(" · ") || "—"}</p>
                      </td>
                      <td className="py-2 pr-3 text-gray-500 text-[11px]">
                        <p>{v.vin || "—"}</p>
                        <p className="text-gray-400">{v.sku || ""}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <StatusDropdown status={v.status} onChange={(s) => handleStatusChange(v, s)} compact />
                      </td>
                      <td className="py-2 pr-3 font-semibold text-gray-800">
                        {v.priceDOP != null ? formatCurrency(v.priceDOP, "DOP") : "—"}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">{(v.mileage ?? 0).toLocaleString("es-DO")} km</td>
                      <td className="py-2 pr-3">
                        {alert ? (
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", alert.cls)}>{v.daysInLot}d</span>
                        ) : (
                          <span className="text-gray-400">{v.daysInLot}d</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">{v.lotLocation || "—"}</td>
                      <td className="py-2 pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setPanelId(v.id)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400"><Edit2 className="h-3 w-3" /></button>
                          <VehicleActionsMenu onViewDetail={() => router.push(`/inventario/${v.id}`)} onEdit={() => setPanelId(v.id)} onDuplicate={() => handleDuplicate(v)} onDelete={() => setDeleting(v)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel */}
      <AnimatePresence>
        {panelId !== null && (
          <VehiclePanel key={panelId} vehicle={panelVehicle} tags={tags} workspaceId={workspaceId} onClose={() => setPanelId(null)} />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleting && <DeleteConfirm key="delete" vehicle={deleting} onConfirm={() => handleDelete(deleting)} onCancel={() => setDeleting(null)} />}
      </AnimatePresence>

      {/* Sell confirm */}
      <AnimatePresence>
        {selling && <SellConfirm key="sell" vehicle={selling} onConfirm={confirmSell} onCancel={() => setSelling(null)} />}
      </AnimatePresence>
    </div>
  );
}
