"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Pencil, Globe, HelpCircle, Table2, FileText, Upload,
  Trash2, Link2, AlertTriangle, Loader2, Search as SearchIcon, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { addKnowledgeItem, removeKnowledgeItem, renameKnowledgeBase } from "@/app/actions/knowledge-base";
import { uploadKnowledgeFile, uploadKnowledgeTable } from "@/app/actions/storage";

type KnowledgeItemType = "TEXTO" | "PREGUNTA_FRECUENTE" | "ARCHIVO" | "URL" | "TABLA";
type KnowledgeItem = {
  id: string; type: KnowledgeItemType; title: string; content: string | null;
  fileUrl: string | null; sourceUrl: string | null; createdAt: string;
};
type KnowledgeBaseDetail = { id: string; name: string; description: string | null; items: KnowledgeItem[] };

const SOURCE_TABS = [
  { key: "ALL", label: "All" },
  { key: "URL", label: "Web crawler" },
  { key: "PREGUNTA_FRECUENTE", label: "FAQ" },
  { key: "TABLA", label: "Tables" },
  { key: "TEXTO", label: "Rich text" },
  { key: "ARCHIVO", label: "Files" },
] as const;
type TabKey = (typeof SOURCE_TABS)[number]["key"];

const TYPE_META: Record<KnowledgeItemType, { label: string; Icon: React.ElementType }> = {
  URL: { label: "Web crawler", Icon: Globe },
  PREGUNTA_FRECUENTE: { label: "FAQ", Icon: HelpCircle },
  TEXTO: { label: "Rich text", Icon: FileText },
  ARCHIVO: { label: "Files", Icon: Upload },
  TABLA: { label: "Tables", Icon: Table2 },
};

const TAB_PANEL_META: Record<Exclude<TabKey, "ALL">, {
  countLabel: string; addLabel: string; emptyTitle: string; emptyDesc: string; Icon: React.ElementType;
}> = {
  URL: { countLabel: "URLs", addLabel: "Add website", emptyTitle: "No websites added yet", emptyDesc: "Add a website to start building your knowledge base.", Icon: Globe },
  PREGUNTA_FRECUENTE: { countLabel: "FAQs", addLabel: "Add FAQ", emptyTitle: "No FAQs added yet", emptyDesc: "Add FAQs to help your agent answer common questions instantly.", Icon: HelpCircle },
  TABLA: { countLabel: "Tables", addLabel: "Add table", emptyTitle: "No tables added yet", emptyDesc: "Upload a table from your computer or import one from Google Sheets to get started.", Icon: Table2 },
  TEXTO: { countLabel: "Rich text", addLabel: "Add rich text", emptyTitle: "No rich text added yet", emptyDesc: "Create rich text content to give your agent detailed instructions or context.", Icon: FileText },
  ARCHIVO: { countLabel: "Files", addLabel: "Add file", emptyTitle: "No files added yet", emptyDesc: "Upload files to add reference material for your agent.", Icon: Upload },
};

export function KnowledgeBaseDetailClient({ kb }: { kb: KnowledgeBaseDetail }) {
  const router = useRouter();
  const [name, setName] = useState(kb.name);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(kb.name);
  const [view, setView] = useState<"sources" | "gaps">("sources");
  const [sourceTab, setSourceTab] = useState<TabKey>("ALL");
  const [items, setItems] = useState(kb.items);
  const [addType, setAddType] = useState<KnowledgeItemType | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [answer, setAnswer] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableInputRef = useRef<HTMLInputElement>(null);

  const filtered = sourceTab === "ALL" ? items : items.filter((i) => i.type === sourceTab);

  function resetForm() {
    setAddType(null); setTitle(""); setContent(""); setAnswer(""); setSourceUrl(""); setError("");
  }

  async function handleSaveName() {
    const next = nameDraft.trim();
    if (!next || next === name) { setEditingName(false); setNameDraft(name); return; }
    setName(next);
    setEditingName(false);
    await renameKnowledgeBase(kb.id, next);
    router.refresh();
  }

  async function handleAddText() {
    if (!title.trim() || !content.trim()) { setError("Completa el título y el contenido."); return; }
    setBusy(true);
    const item = await addKnowledgeItem(kb.id, { type: "TEXTO", title: title.trim(), content: content.trim() });
    setItems((prev) => [{ ...item, createdAt: item.createdAt.toISOString() }, ...prev]);
    setBusy(false);
    resetForm();
  }

  async function handleAddFaq() {
    if (!title.trim() || !answer.trim()) { setError("Completa la pregunta y la respuesta."); return; }
    setBusy(true);
    const item = await addKnowledgeItem(kb.id, { type: "PREGUNTA_FRECUENTE", title: title.trim(), content: answer.trim() });
    setItems((prev) => [{ ...item, createdAt: item.createdAt.toISOString() }, ...prev]);
    setBusy(false);
    resetForm();
  }

  async function handleAddUrl() {
    if (!title.trim() || !sourceUrl.trim()) { setError("Completa el título y la URL."); return; }
    setBusy(true);
    const item = await addKnowledgeItem(kb.id, { type: "URL", title: title.trim(), sourceUrl: sourceUrl.trim() });
    setItems((prev) => [{ ...item, createdAt: item.createdAt.toISOString() }, ...prev]);
    setBusy(false);
    resetForm();
  }

  async function handleFileChosen(file: File) {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadKnowledgeFile(fd);
    if (result.error) { setError(result.error); setBusy(false); return; }
    const item = await addKnowledgeItem(kb.id, { type: "ARCHIVO", title: file.name, fileUrl: result.url });
    setItems((prev) => [{ ...item, createdAt: item.createdAt.toISOString() }, ...prev]);
    setBusy(false);
    resetForm();
  }

  async function handleTableChosen(file: File) {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadKnowledgeTable(fd);
    if (result.error) { setError(result.error); setBusy(false); return; }
    const item = await addKnowledgeItem(kb.id, { type: "TABLA", title: file.name, fileUrl: result.url });
    setItems((prev) => [{ ...item, createdAt: item.createdAt.toISOString() }, ...prev]);
    setBusy(false);
    resetForm();
  }

  async function handleRemove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await removeKnowledgeItem(id);
  }

  function openAdd(type: KnowledgeItemType) {
    resetForm();
    if (type === "ARCHIVO") { fileInputRef.current?.click(); return; }
    if (type === "TABLA") { tableInputRef.current?.click(); return; }
    setAddType(type);
  }

  const hiddenInputs = (
    <>
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFileChosen(e.target.files[0]); e.target.value = ""; }} />
      <input ref={tableInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleTableChosen(e.target.files[0]); e.target.value = ""; }} />
    </>
  );

  const inlineForm = (
    <AnimatePresence>
      {addType && (addType === "TEXTO" || addType === "PREGUNTA_FRECUENTE" || addType === "URL") && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden mb-4">
          <div className="border border-gray-200 rounded-lg p-4 space-y-2.5 bg-gray-50/50">
            {addType === "TEXTO" && (
              <>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary bg-white" />
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Contenido…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary bg-white resize-none" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
                  <Button size="sm" disabled={busy} onClick={handleAddText}>{busy ? "Guardando…" : "Agregar"}</Button>
                </div>
              </>
            )}
            {addType === "PREGUNTA_FRECUENTE" && (
              <>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pregunta"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary bg-white" />
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder="Respuesta…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary bg-white resize-none" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
                  <Button size="sm" disabled={busy} onClick={handleAddFaq}>{busy ? "Guardando…" : "Agregar"}</Button>
                </div>
              </>
            )}
            {addType === "URL" && (
              <>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary bg-white" />
                <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary bg-white" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
                  <Button size="sm" disabled={busy} onClick={handleAddUrl}>{busy ? "Guardando…" : "Agregar"}</Button>
                </div>
              </>
            )}
            {error && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {error}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  function itemRow(item: KnowledgeItem, showTypeBadge: boolean) {
    const meta = TYPE_META[item.type];
    return (
      <div key={item.id} className="flex items-start gap-3 border border-gray-100 rounded-lg px-3.5 py-3 hover:bg-gray-50/60">
        <meta.Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[12.5px] font-semibold text-gray-800 truncate">{item.title}</p>
            {showTypeBadge && <span className="text-[9.5px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">{meta.label}</span>}
          </div>
          {item.content && <p className="text-[11.5px] text-gray-500 line-clamp-2 mt-0.5">{item.content}</p>}
          {item.sourceUrl && (
            <p className="text-[11.5px] text-primary truncate mt-0.5 flex items-center gap-1"><Link2 className="h-3 w-3 shrink-0" /> {item.sourceUrl}</p>
          )}
          {item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-[11.5px] text-primary hover:underline">Ver archivo</a>}
        </div>
        <button onClick={() => handleRemove(item.id)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F5F5F5] overflow-y-auto">
      <div className="bg-white border-b border-gray-100 px-6 pt-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <button onClick={() => router.push("/agentes?tab=knowledge-base")} className="text-gray-400 hover:text-gray-600 mt-1"><ArrowLeft className="h-4 w-4" /></button>
            <div>
              <div className="flex items-center gap-2">
                {editingName ? (
                  <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setEditingName(false); setNameDraft(name); } }}
                    onBlur={handleSaveName}
                    className="text-[18px] font-bold text-gray-900 border border-primary rounded-md px-1.5 py-0.5 outline-none" />
                ) : (
                  <h1 className="text-[18px] font-bold text-gray-900">Knowledge base - {name}</h1>
                )}
                {!editingName && (
                  <button onClick={() => { setNameDraft(name); setEditingName(true); }} className="text-gray-400 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                )}
              </div>
              <p className="text-[12px] text-gray-400">{kb.description || "Base de conocimiento reutilizable para tus agentes"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50">
            <button onClick={() => setView("sources")}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors ${view === "sources" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
              Knowledge sources
            </button>
            <button onClick={() => setView("gaps")}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${view === "gaps" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>
              Knowledge gaps <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">0</span>
            </button>
          </div>
        </div>

        {view === "sources" && (
          <div className="flex items-center gap-5 mt-4">
            {SOURCE_TABS.map((t) => (
              <button key={t.key} onClick={() => { setSourceTab(t.key); resetForm(); }}
                className={`text-[13px] font-medium pb-2.5 border-b-2 -mb-px transition-colors ${sourceTab === t.key ? "text-primary border-primary" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-6">
        {view === "gaps" ? (
          <div className="flex flex-col items-center gap-2 py-24 text-gray-300 bg-white border border-gray-200 rounded-xl">
            <SearchIcon className="h-8 w-8" />
            <span className="text-[13px] font-medium text-gray-500">No se han detectado brechas de conocimiento</span>
            <span className="text-[12px] text-gray-400 max-w-sm text-center">Las preguntas que el bot no pueda responder con esta base aparecerán aquí para que agregues contenido.</span>
          </div>
        ) : sourceTab === "ALL" ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-gray-300">
                <div className="h-14 w-14 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-[13px] font-semibold text-gray-600">No knowledge sources added!!</span>
                <span className="text-[12px] text-gray-400 max-w-md text-center">
                  Start by clicking on one of the options above to add content from websites, FAQs, or other sources. This will help your bot respond accurately to user questions.
                </span>
              </div>
            ) : (
              <div className="space-y-2">{filtered.map((item) => itemRow(item, true))}</div>
            )}
          </div>
        ) : (
          (() => {
            const meta = TAB_PANEL_META[sourceTab];
            return (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
                    {meta.countLabel} <span className="text-[11px] text-green-600 font-semibold">{filtered.length}</span>
                  </p>
                  <Button size="sm" onClick={() => openAdd(sourceTab)} className="text-[12px] gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> {meta.addLabel}
                  </Button>
                </div>

                {hiddenInputs}
                {inlineForm}

                {busy && !addType && <p className="text-[12px] text-gray-400 flex items-center gap-1.5 mb-3"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo archivo…</p>}
                {error && !addType && <p className="text-[11px] text-red-500 flex items-center gap-1 mb-3"><AlertTriangle className="h-3 w-3" /> {error}</p>}

                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-20 text-gray-300">
                    <div className="h-16 w-16 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                      <meta.Icon className="h-7 w-7" />
                    </div>
                    <span className="text-[13.5px] font-semibold text-gray-700">{meta.emptyTitle}</span>
                    <span className="text-[12px] text-gray-400 max-w-sm text-center">{meta.emptyDesc}</span>
                    {sourceTab === "TABLA" ? (
                      <div className="flex items-center gap-2 mt-1.5">
                        <Button size="sm" variant="outline" onClick={() => tableInputRef.current?.click()}>Upload from computer</Button>
                        <Button size="sm" disabled title="Requiere conectar Google Sheets (próximamente)">Import from Google Sheets</Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => openAdd(sourceTab)} className="mt-1.5 gap-1.5"><Plus className="h-3.5 w-3.5" /> {meta.addLabel}</Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">{filtered.map((item) => itemRow(item, false))}</div>
                )}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
