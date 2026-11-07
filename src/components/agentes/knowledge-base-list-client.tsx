"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Search, ChevronDown, Pencil, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createKnowledgeBase, deleteKnowledgeBase } from "@/app/actions/knowledge-base";

export type KnowledgeBaseSummary = { id: string; name: string; itemsCount: number; createdAt: string; updatedAt: string };

const QUOTA = 15;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" }) +
    ", " + new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const SORT_OPTIONS = [
  { key: "recent", label: "Más recientes" },
  { key: "name", label: "Nombre (A-Z)" },
  { key: "updated", label: "Última actualización" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export function KnowledgeBaseListClient({ workspaceId, bases }: { workspaceId: string; bases: KnowledgeBaseSummary[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = bases
    .filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  async function handleCreate() {
    setCreating(true);
    const kb = await createKnowledgeBase(workspaceId, `Knowledge base ${bases.length + 1}`);
    router.push(`/agentes/knowledge-base/${kb.id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta base de conocimiento? Se quitará de todos los agentes que la usen.")) return;
    setDeletingId(id);
    await deleteKnowledgeBase(id);
    router.refresh();
    setDeletingId(null);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Knowledge base</h2>
          <p className="text-[12px] text-gray-400">Crea y administra las bases de conocimiento reutilizables para tus agentes</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-gray-500">Knowledge base quota <span className="font-semibold text-gray-700">{bases.length} / {QUOTA}</span></span>
          <Button variant="outline" size="sm" disabled className="text-[12px] gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Create with AI
            <span className="text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Beta</span>
          </Button>
          <Button size="sm" disabled={creating || bases.length >= QUOTA} onClick={handleCreate} className="text-[12px] gap-1.5">
            <Plus className="h-3.5 w-3.5" /> {creating ? "Creando…" : "Create knowledge base"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 text-[12.5px] font-medium border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700">
              {SORT_OPTIONS.find((o) => o.key === sort)?.label} <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SORT_OPTIONS.map((o) => (
              <DropdownMenuItem key={o.key} onClick={() => setSort(o.key)} className="text-xs">{o.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="relative w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search knowledge base"
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary bg-white" />
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-4">Name</th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3">KB gaps</th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3">Last updated</th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3">Created at</th>
              <th className="w-20 text-left font-semibold text-gray-500 py-2.5 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-14">
                  <div className="flex flex-col items-center gap-2 text-gray-300">
                    <BookOpen className="h-8 w-8" />
                    <span className="text-[12px] text-gray-400">{bases.length === 0 ? "Sin bases de conocimiento todavía" : "Sin resultados"}</span>
                  </div>
                </td>
              </tr>
            ) : filtered.map((kb) => (
              <tr key={kb.id} onClick={() => router.push(`/agentes/knowledge-base/${kb.id}`)}
                className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer">
                <td className="px-4 py-3 font-medium text-primary">{kb.name}</td>
                <td className="px-3 py-3 text-orange-500 font-semibold">0</td>
                <td className="px-3 py-3 text-gray-600">{fmtDate(kb.updatedAt)}</td>
                <td className="px-3 py-3 text-gray-600">{fmtDate(kb.createdAt)}</td>
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => router.push(`/agentes/knowledge-base/${kb.id}`)} className="text-gray-400 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(kb.id)} disabled={deletingId === kb.id} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
