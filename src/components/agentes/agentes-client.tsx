"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, ChevronDown, Check, Search, MoreVertical,
  Bot, Calendar as CalendarIcon, Info,
  Edit2, Star, Copy, Trash2, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { createAgent, setPrimaryAgent, duplicateAgent, deleteAgent } from "@/app/actions/agents";
import { KnowledgeBaseListClient, type KnowledgeBaseSummary } from "@/components/agentes/knowledge-base-list-client";

// ── Types ─────────────────────────────────────────────────
type AiAgentStatus = "OFF" | "SUGGESTIVE" | "AUTO_PILOT";
type AgentChannel = "SMS" | "INSTAGRAM" | "FACEBOOK" | "CHAT_WIDGET" | "LIVE_CHAT" | "WHATSAPP";

export type Agent = {
  id: string; name: string; isPrimary: boolean; status: AiAgentStatus;
  channels: AgentChannel[];
  createdAt: string; updatedAt: string;
};

type AiConversation = { id: string; channel: string; leadName: string; lastMessageAt: string | null; messageCount: number };

// ── Constants ─────────────────────────────────────────────
export const STATUS_CFG: Record<AiAgentStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  OFF:         { label: "Off",         color: "text-gray-500",  bg: "bg-gray-100",  border: "border-gray-300",  dot: "bg-gray-400" },
  SUGGESTIVE:  { label: "Suggestive",  color: "text-blue-700",  bg: "bg-blue-50",   border: "border-blue-300",  dot: "bg-blue-500" },
  AUTO_PILOT:  { label: "Auto Pilot",  color: "text-green-700", bg: "bg-green-50",  border: "border-green-300", dot: "bg-green-500" },
};

export const CHANNEL_LABEL: Record<AgentChannel, string> = {
  SMS: "SMS", INSTAGRAM: "Instagram", FACEBOOK: "Facebook",
  CHAT_WIDGET: "Chat Widget (SMS chat)", LIVE_CHAT: "Live Chat", WHATSAPP: "WhatsApp",
};

const CHANNEL_ORDER: AgentChannel[] = ["SMS", "INSTAGRAM", "FACEBOOK", "CHAT_WIDGET", "LIVE_CHAT", "WHATSAPP"];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" }) +
    " " + new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function StatusPill({ status }: { status: AiAgentStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", cfg.bg, cfg.border, cfg.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────
function DashboardTab({ agents, conversations }: { agents: Agent[]; conversations: AiConversation[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [channelFilter, setChannelFilter] = useState<AgentChannel | "">("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [agentFilter, setAgentFilter] = useState("");
  const [selectContact, setSelectContact] = useState("");

  const filtered = conversations.filter((c) => {
    if (channelFilter && c.channel !== channelFilter) return false;
    if (selectContact && c.leadName !== selectContact) return false;
    if (c.lastMessageAt) {
      const d = c.lastMessageAt.slice(0, 10);
      if (d < dateFrom || d > dateTo) return false;
    }
    return true;
  });

  const totalUniqueContacts = filtered.length;
  const totalMessages = filtered.reduce((sum, c) => sum + c.messageCount, 0);
  const avgMessages = totalUniqueContacts ? (totalMessages / totalUniqueContacts).toFixed(1) : null;
  const contactNames = Array.from(new Set(conversations.map((c) => c.leadName))).sort();

  return (
    <div className="p-6 space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 text-[12px] border border-gray-200 text-gray-600 rounded-lg px-3 py-2 hover:bg-gray-50 bg-white">
              {channelFilter ? CHANNEL_LABEL[channelFilter] : "All Channels"}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setChannelFilter("")} className="text-xs">All Channels</DropdownMenuItem>
            <DropdownMenuSeparator />
            {CHANNEL_ORDER.map((c) => (
              <DropdownMenuItem key={c} onClick={() => setChannelFilter(c)} className="text-xs justify-between">
                {CHANNEL_LABEL[c]}
                {channelFilter === c && <Check className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="text-[12px] outline-none text-gray-600 w-[110px]" />
          <span className="text-gray-300">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="text-[12px] outline-none text-gray-600 w-[110px]" />
          <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 text-[12px] border border-gray-200 text-gray-600 rounded-lg px-3 py-2 hover:bg-gray-50 bg-white">
              {agentFilter ? agents.find((a) => a.id === agentFilter)?.name : "All Agents"}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setAgentFilter("")} className="text-xs">All Agents</DropdownMenuItem>
            <DropdownMenuSeparator />
            {agents.map((a) => (
              <DropdownMenuItem key={a.id} onClick={() => setAgentFilter(a.id)} className="text-xs">{a.name}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border-2 border-primary rounded-xl p-4 bg-white">
          <p className="text-[12px] text-primary font-medium mb-2">Total Unique Contacts</p>
          <p className="text-[26px] font-bold text-gray-900">{totalUniqueContacts || "-"}</p>
          {!totalUniqueContacts && <p className="text-[11px] text-primary mt-1">Data for the selected timeframe isn&apos;t available.</p>}
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <p className="text-[12px] text-gray-500 font-medium mb-2">Total Actions Triggered</p>
          <p className="text-[26px] font-bold text-gray-900">-</p>
          <p className="text-[11px] text-gray-400 mt-1">Data for the selected timeframe isn&apos;t available.</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <p className="text-[12px] text-gray-500 font-medium mb-2">Total Appointment Booked</p>
          <p className="text-[26px] font-bold text-gray-900">-</p>
          <p className="text-[11px] text-gray-400 mt-1">Data for the selected timeframe isn&apos;t available.</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <p className="text-[12px] text-gray-500 font-medium mb-2 flex items-center gap-1">Time Saved <Info className="h-3 w-3" /></p>
          <p className="text-[26px] font-bold text-gray-900">-</p>
          <p className="text-[11px] text-gray-400 mt-1">Data for the selected timeframe isn&apos;t available.</p>
        </div>
      </div>

      {/* Chart panel */}
      <div className="border border-gray-200 rounded-xl bg-white p-5">
        <p className="text-[13px] font-semibold text-gray-700 flex items-center gap-1 mb-6">Total Unique Contacts <Info className="h-3 w-3 text-gray-400" /></p>
        <div className="flex items-center justify-center h-[200px] text-[13px] text-gray-400">
          Data for the selected timeframe isn&apos;t available.
        </div>
      </div>

      {/* Message panels */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-xl bg-white p-5">
          <p className="text-[13px] font-semibold text-gray-700 mb-2">Total Message</p>
          <p className="text-[24px] font-bold text-gray-900">{totalMessages || "-"}</p>
          {!totalMessages && <p className="text-[11px] text-gray-400 mt-1">Data for the selected timeframe isn&apos;t available.</p>}
        </div>
        <div className="border border-gray-200 rounded-xl bg-white p-5 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-gray-700 mb-2">Average Messages per Contact</p>
            <p className="text-[24px] font-bold text-gray-900">{avgMessages ?? "-"}</p>
          </div>
          {!avgMessages && <p className="text-[11px] text-gray-400">Data for the selected timeframe isn&apos;t available.</p>}
        </div>
      </div>

      {/* Total Conversations */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-[14px] font-semibold text-gray-800">Total Conversations ({filtered.length})</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-[12px] border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                {selectContact || "Select Contact"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
              <DropdownMenuItem onClick={() => setSelectContact("")} className="text-xs">Todos</DropdownMenuItem>
              {contactNames.map((n) => (
                <DropdownMenuItem key={n} onClick={() => setSelectContact(n)} className="text-xs">{n}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <table className="w-full text-[12px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-5">Contact Name</th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3">Channel Name</th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3">Agent Name</th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3">Last Message Date &amp; Time</th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-14">
                  <div className="flex flex-col items-center gap-2 text-gray-300">
                    <Inbox className="h-8 w-8" />
                    <span className="text-[12px] text-gray-400">No Data</span>
                  </div>
                </td>
              </tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="py-2.5 px-5 text-gray-700">{c.leadName}</td>
                <td className="py-2.5 px-3 text-gray-500">{c.channel}</td>
                <td className="py-2.5 px-3 text-gray-500">{agents.find((a) => a.isPrimary)?.name ?? "—"}</td>
                <td className="py-2.5 px-3 text-gray-500">{fmtDate(c.lastMessageAt)}</td>
                <td className="py-2.5 px-5 text-gray-400">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Agent actions menu ────────────────────────────────────
function AgentActionsMenu({ agent, workspaceId, onEdit, onDeleted }: {
  agent: Agent; workspaceId: string; onEdit: () => void; onDeleted: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await deleteAgent(agent.id);
    router.refresh();
    onDeleted();
  }
  async function handleDuplicate() {
    const clone = await duplicateAgent(agent.id);
    router.refresh();
    if (clone) router.push(`/agentes/${clone.id}`);
  }
  async function handleSetPrimary() {
    await setPrimaryAgent(agent.id, workspaceId);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit} className="text-xs gap-2"><Edit2 className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
        {!agent.isPrimary && (
          <DropdownMenuItem onClick={handleSetPrimary} className="text-xs gap-2"><Star className="h-3.5 w-3.5" /> Marcar como Primary</DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleDuplicate} className="text-xs gap-2"><Copy className="h-3.5 w-3.5" /> Duplicar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDelete} disabled={deleting} className="text-xs gap-2 text-red-500 focus:text-red-600">
          <Trash2 className="h-3.5 w-3.5" /> {deleting ? "Eliminando…" : "Eliminar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Agents List Tab ───────────────────────────────────────
function AgentsListTab({ agents, workspaceId }: { agents: Agent[]; workspaceId: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start gap-2.5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-gray-700">Important</p>
          <p className="text-[12px] text-gray-500">
            Only the primary agent will reply to inbound messages. Make sure your preferred channels are assigned to the primary agent to handle inbound messages.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="relative w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search Agent"
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary bg-white" />
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="w-10 py-2.5 px-4"><input type="checkbox" className="accent-primary" disabled /></th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3">Agent Name</th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3 flex items-center gap-1 mt-2.5">Status <Info className="h-3 w-3" /></th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3">Supported Channels</th>
              <th className="text-left font-semibold text-gray-500 py-2.5 px-3">Last Updated <Info className="h-3 w-3 inline" /></th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14">
                  <div className="flex flex-col items-center gap-2 text-gray-300">
                    <Bot className="h-8 w-8" />
                    <span className="text-[12px] text-gray-400">{agents.length === 0 ? "Sin agentes todavía" : "Sin resultados"}</span>
                  </div>
                </td>
              </tr>
            ) : pageItems.map((a) => (
              <tr key={a.id} onClick={() => router.push(`/agentes/${a.id}`)}
                className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer">
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} className="accent-primary" />
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-gray-800">{a.name}</p>
                  {a.isPrimary && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Primary
                    </span>
                  )}
                </td>
                <td className="px-3 py-3"><StatusPill status={a.status} /></td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {a.channels.length === 0
                      ? <span className="text-gray-300">—</span>
                      : a.channels.map((c) => (
                        <span key={c} className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{CHANNEL_LABEL[c]}</span>
                      ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-gray-500">{fmtDate(a.updatedAt)}</td>
                <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                  <AgentActionsMenu agent={a} workspaceId={workspaceId} onEdit={() => router.push(`/agentes/${a.id}`)} onDeleted={() => {}} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-[12px] text-gray-500">
          <span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} results</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 text-[12px]">Previous</Button>
            <span className="flex items-center justify-center h-7 w-7 rounded-md border border-primary text-primary font-semibold">{page}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 text-[12px]">Next</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-[12px] border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50">
                  {pageSize} / page <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[10, 25, 50].map((n) => (
                  <DropdownMenuItem key={n} onClick={() => { setPageSize(n); setPage(1); }} className="text-xs">{n} / page</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
type AgentesTab = "dashboard" | "list" | "knowledge-base";

export function AgentesClient({ agents, conversations, workspaceId, knowledgeBases }: {
  agents: Agent[]; conversations: AiConversation[]; workspaceId: string; knowledgeBases: KnowledgeBaseSummary[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<AgentesTab>(
    initialTab === "list" ? "list" : initialTab === "knowledge-base" ? "knowledge-base" : "dashboard"
  );
  const [creating, setCreating] = useState(false);

  async function handleCreateBot() {
    setCreating(true);
    const agent = await createAgent(workspaceId, `New Employee ${Date.now()}`);
    router.push(`/agentes/${agent.id}`);
  }

  return (
    <div className="flex flex-col h-full bg-[#F5F5F5] overflow-y-auto">
      <div className="bg-white border-b border-gray-100 px-6 pt-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900">Conversation AI Agents</h1>
            <p className="text-[13px] text-gray-400">Create And Manage Multiple Agents For Your Business</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={creating} onClick={handleCreateBot} className="text-[12px] gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {creating ? "Creando…" : "Create Bot"}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {([["dashboard", "Dashboard"], ["list", "Agents List"], ["knowledge-base", "Knowledge Base"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn("text-[13px] font-medium pb-2.5 border-b-2 -mb-px transition-colors",
                tab === key ? "text-primary border-primary" : "text-gray-500 border-transparent hover:text-gray-700")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>
        {tab === "dashboard" && <DashboardTab agents={agents} conversations={conversations} />}
        {tab === "list" && <AgentsListTab agents={agents} workspaceId={workspaceId} />}
        {tab === "knowledge-base" && <KnowledgeBaseListClient workspaceId={workspaceId} bases={knowledgeBases} />}
      </motion.div>
    </div>
  );
}
