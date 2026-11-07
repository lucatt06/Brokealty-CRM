"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown, Check, Star, MessageSquare, Send, RotateCcw,
  Sparkles, Plus, X, BookOpen,
  Info, AlertTriangle, Loader2, Bot, Wrench, Paperclip, Mic, Square, FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateAgentSettings, updateAgentGoals, setPrimaryAgent } from "@/app/actions/agents";
import { setAgentKnowledgeBases, createKnowledgeBase } from "@/app/actions/knowledge-base";
import { testAgentChat } from "@/app/actions/ai-chat";
import { AI_MODELS } from "@/lib/ai-models";
import { CHANNEL_LABEL } from "@/components/agentes/agentes-client";
import {
  saveActionConfig, removeActionConfig, updateConversationSummary, setAssignedTools, createCustomTool, deleteCustomTool,
} from "@/app/actions/agent-config";
import {
  AppointmentBookingModal, TriggerWorkflowModal, ContactInfoModal, StopBotModal, HumanHandoverModal,
  BotTransferModal, AutoFollowupModal, ToolKitModal, ModalShell, FieldLabel, FieldHint, TextInput, Toggle as ModalToggle,
  type WUser, type WTag, type WWorkflow, type OtherAgent,
} from "@/components/agentes/action-modals";

// ── Types ─────────────────────────────────────────────────
type AiAgentStatus = "OFF" | "SUGGESTIVE" | "AUTO_PILOT";
type AgentChannel = "SMS" | "INSTAGRAM" | "FACEBOOK" | "CHAT_WIDGET" | "LIVE_CHAT" | "WHATSAPP";

type AgentTool = {
  id: string; key: string; name: string; description: string; category: string;
  method: string; examplePrompt: string | null; isBuiltIn: boolean; createdAt: string;
};

type KnowledgeBaseSummary = { id: string; name: string; itemsCount: number };

type Agent = {
  id: string; workspaceId: string; name: string; isPrimary: boolean; status: AiAgentStatus;
  channels: AgentChannel[];
  businessName: string | null; waitTimeValue: number; waitTimeUnit: string;
  respondToImages: boolean; respondToVoiceNotes: boolean; respondToPdfs: boolean;
  sleepOnManualMessage: boolean; sleepOnWorkflowMessage: boolean;
  model: string; personality: string | null; goal: string | null; additionalInfo: string | null;
  actions: string[]; actionsConfig: Record<string, unknown> | null;
  conversationSummaryEnabled: boolean; conversationSummaryConfig: Record<string, unknown> | null;
  assignedToolIds: string[];
  knowledgeBaseIds: string[];
  createdAt: string; updatedAt: string;
};

const CHANNEL_ORDER: AgentChannel[] = ["SMS", "INSTAGRAM", "FACEBOOK", "CHAT_WIDGET", "LIVE_CHAT", "WHATSAPP"];

const STATUS_OPTIONS: { key: AiAgentStatus; title: string; desc: string; Icon: React.ElementType }[] = [
  { key: "OFF", title: "Off", desc: "Turn off Conversations AI", Icon: Bot },
  { key: "SUGGESTIVE", title: "Suggestive", desc: "Suggests prompts within chat window", Icon: MessageSquare },
  { key: "AUTO_PILOT", title: "Auto Pilot", desc: "Bot replies automatically based on trained data", Icon: Send },
];

const ACTION_OPTIONS: { key: string; label: string }[] = [
  { key: "APPOINTMENT_BOOKING", label: "Appointment Booking" },
  { key: "TRIGGER_WORKFLOW", label: "Trigger a Workflow" },
  { key: "CONTACT_INFO", label: "Contact Info" },
  { key: "STOP_BOT", label: "Stop Bot" },
  { key: "HUMAN_HANDOVER", label: "Human Handover" },
  { key: "TRANSFER_BOT", label: "Transfer Bot" },
  { key: "AUTO_FOLLOWUP", label: "Auto Followup" },
];


const CUSTOM_VALUES = [
  { label: "Business Name", token: "{{ai.business_name}}" },
  { label: "Contact First Name", token: "{{contact.first_name}}" },
  { label: "Contact Last Name", token: "{{contact.last_name}}" },
  { label: "Contact Phone", token: "{{contact.phone}}" },
];

// ── Bot Settings Tab ──────────────────────────────────────
function BotSettingsTab({ agent, workspaceName, onSaved }: { agent: Agent; workspaceName: string; onSaved: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(agent.name);
  const [status, setStatus] = useState<AiAgentStatus>(agent.status);
  const [channels, setChannels] = useState<AgentChannel[]>(agent.channels);
  const [businessName, setBusinessName] = useState(agent.businessName ?? "");
  const [waitTimeValue, setWaitTimeValue] = useState(agent.waitTimeValue);
  const [waitTimeUnit, setWaitTimeUnit] = useState(agent.waitTimeUnit);
  const [respondToImages, setRespondToImages] = useState(agent.respondToImages);
  const [respondToVoiceNotes, setRespondToVoiceNotes] = useState(agent.respondToVoiceNotes);
  const [respondToPdfs, setRespondToPdfs] = useState(agent.respondToPdfs);
  const [sleepOnManualMessage, setSleepOnManualMessage] = useState(agent.sleepOnManualMessage);
  const [sleepOnWorkflowMessage, setSleepOnWorkflowMessage] = useState(agent.sleepOnWorkflowMessage);
  const [saving, setSaving] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);

  function toggleChannel(c: AgentChannel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleSetPrimary() {
    setSettingPrimary(true);
    await setPrimaryAgent(agent.id, agent.workspaceId);
    router.refresh();
    setSettingPrimary(false);
  }

  async function handleSave() {
    setSaving(true);
    await updateAgentSettings(agent.id, {
      name, status, channels, businessName,
      waitTimeValue, waitTimeUnit,
      respondToImages, respondToVoiceNotes, respondToPdfs,
      sleepOnManualMessage, sleepOnWorkflowMessage,
    });
    router.refresh();
    setSaving(false);
    onSaved();
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
      className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0", value ? "bg-primary" : "bg-gray-200")}>
      <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", value ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-5">
      {/* Bot Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Bot Details</h2>
            <p className="text-[12px] text-gray-400">Configure your bot&apos;s communication preferences and settings</p>
          </div>
          {agent.isPrimary ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              <Star className="h-3 w-3 fill-primary" /> Primary Bot
            </span>
          ) : (
            <Button variant="outline" size="sm" disabled={settingPrimary} onClick={handleSetPrimary} className="text-[12px]">
              {settingPrimary ? "…" : "Set as Primary Bot"}
            </Button>
          )}
        </div>

        <label className="text-[12px] font-medium text-gray-700 block mb-1.5">Bot Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary mb-5" />

        <p className="text-[12px] font-medium text-gray-700 mb-0.5">Set Bot Status</p>
        <p className="text-[11px] text-gray-400 mb-2.5">Choose the bot&apos;s operating mode (choose one)</p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {STATUS_OPTIONS.map(({ key, title, desc, Icon }) => (
            <button key={key} onClick={() => setStatus(key)}
              className={cn("text-left rounded-lg border-2 p-3.5 transition-colors",
                status === key ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300")}>
              <div className="flex items-center justify-between mb-2">
                <Icon className={cn("h-4 w-4", status === key ? "text-primary" : "text-gray-400")} />
                <div className={cn("h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                  status === key ? "border-primary" : "border-gray-300")}>
                  {status === key && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
              </div>
              <p className="text-[13px] font-semibold text-gray-800">{title}</p>
              <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{desc}</p>
            </button>
          ))}
        </div>

        <p className="text-[12px] font-medium text-gray-700 mb-0.5">Supported Communication Channels/Providers</p>
        <p className="text-[11px] text-gray-400 mb-2">Select the Channels where you want the Bot to be Active On</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-2 min-h-[42px] mb-5">
              {channels.length === 0 && <span className="text-[12px] text-gray-300">Seleccionar canales…</span>}
              {channels.map((c) => (
                <span key={c} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-[11px] font-medium px-2 py-1 rounded-full">
                  {CHANNEL_LABEL[c]}
                  <button onClick={(e) => { e.stopPropagation(); toggleChannel(c); }} className="hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {CHANNEL_ORDER.map((c) => (
              <DropdownMenuItem key={c} onSelect={(e) => e.preventDefault()} onClick={() => toggleChannel(c)} className="text-xs gap-2">
                <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center", channels.includes(c) ? "bg-primary border-primary" : "border-gray-300")}>
                  {channels.includes(c) && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                {CHANNEL_LABEL[c]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Advanced Settings */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-[15px] font-bold text-gray-900 mb-0.5">Advanced Settings</h2>
        <p className="text-[12px] text-gray-400 mb-4">Fine-Tune your Bot&apos;s Behavior</p>

        <label className="text-[12px] font-medium text-gray-700 block mb-1.5">Business Name (default is the location name)</label>
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={`Enter business name (default: ${workspaceName})`}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary mb-5" />

        <div className="border-t border-gray-100 pt-4">
          <p className="text-[13px] font-semibold text-gray-800">Auto-pilot mode</p>
          <p className="text-[11px] text-gray-400 mb-3">Configure settings for the auto-pilot mode based on your business needs</p>

          <label className="text-[12px] font-medium text-gray-700 flex items-center gap-1 mb-1.5">Wait time before responding * <Info className="h-3 w-3 text-gray-300" /></label>
          <div className="flex gap-2 mb-4">
            <input type="number" min={0} value={waitTimeValue} onChange={(e) => setWaitTimeValue(Number(e.target.value))}
              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-primary">
                  {waitTimeUnit === "SECONDS" ? "Seconds" : "Minutes"} <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setWaitTimeUnit("SECONDS")} className="text-xs">Seconds</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWaitTimeUnit("MINUTES")} className="text-xs">Minutes</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-6 mb-1.5 flex-wrap">
            <span className="text-[12px] font-medium text-gray-700">Also allow this bot to respond to:</span>
            <label className="flex items-center gap-2 text-[12px] text-gray-600"><Toggle value={respondToImages} onChange={setRespondToImages} /> Images</label>
            <label className="flex items-center gap-2 text-[12px] text-gray-600"><Toggle value={respondToPdfs} onChange={setRespondToPdfs} /> PDFs</label>
            <label className="flex items-center gap-2 text-[12px] text-gray-600"><Toggle value={respondToVoiceNotes} onChange={setRespondToVoiceNotes} /> Voice Notes</label>
          </div>
          <p className="text-[11px] text-gray-400 mb-4">Note: Responses to images, PDFs and voice notes may take slightly longer than normal replies. This feature is currently supported only in Auto-Pilot mode.</p>

          <div className="flex items-center gap-6 mb-1.5">
            <span className="text-[12px] font-medium text-gray-700">Send bot to sleep when I send a:</span>
            <label className="flex items-center gap-2 text-[12px] text-gray-600"><Toggle value={sleepOnManualMessage} onChange={setSleepOnManualMessage} /> Manual Message</label>
            <label className="flex items-center gap-2 text-[12px] text-gray-600"><Toggle value={sleepOnWorkflowMessage} onChange={setSleepOnWorkflowMessage} /> Workflow Message</label>
          </div>
          <p className="text-[11px] text-gray-400">The bot will pause responses when the selected message type is sent. Enable both to pause on any outbound message.</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pb-2">
        <Button variant="outline" size="sm" onClick={() => router.push("/agentes")}>Cancel</Button>
        <Button size="sm" disabled={!name.trim() || saving} onClick={handleSave}>{saving ? "Guardando…" : "Save"}</Button>
      </div>
    </div>
  );
}

// ── Knowledge Base Modal ───────────────────────────────────
function KnowledgeBaseModal({ workspaceId, knowledgeBases, assignedIds, onClose, onToggleAssign }: {
  workspaceId: string; knowledgeBases: KnowledgeBaseSummary[]; assignedIds: string[];
  onClose: () => void; onToggleAssign: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggle(id: string) {
    setBusyId(id);
    await onToggleAssign(id);
    setBusyId(null);
  }

  async function handleCreate() {
    setCreating(true);
    const kb = await createKnowledgeBase(workspaceId, `Knowledge base ${knowledgeBases.length + 1}`);
    router.push(`/agentes/knowledge-base/${kb.id}`);
  }

  return (
    <ModalShell icon={BookOpen} title="Knowledge Base" subtitle="Elige las bases de conocimiento que este bot usará para responder preguntas" onClose={onClose} width={560}
      footer={<><div /><Button size="sm" variant="outline" onClick={onClose}>Cerrar</Button></>}>
      <div className="px-5 py-4">
        <Button size="sm" disabled={creating} onClick={handleCreate} className="text-[12px] gap-1.5 mb-4">
          <Plus className="h-3.5 w-3.5" /> {creating ? "Creando…" : "Crear nueva base de conocimiento"}
        </Button>

        {knowledgeBases.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-gray-300">
            <BookOpen className="h-8 w-8" />
            <span className="text-[12px] text-gray-400">Sin bases de conocimiento en el workspace todavía</span>
          </div>
        ) : (
          <div className="space-y-2">
            {knowledgeBases.map((kb) => {
              const attached = assignedIds.includes(kb.id);
              return (
                <div key={kb.id} className={cn("flex items-center gap-3 border rounded-lg px-3.5 py-3 transition-colors",
                  attached ? "border-primary/30 bg-primary/5" : "border-gray-100 hover:bg-gray-50/60")}>
                  <BookOpen className={cn("h-4 w-4 shrink-0", attached ? "text-primary" : "text-gray-400")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-gray-800 truncate">{kb.name}</p>
                    <p className="text-[11px] text-gray-400">{kb.itemsCount} fuente{kb.itemsCount !== 1 ? "s" : ""}</p>
                  </div>
                  <button onClick={() => router.push(`/agentes/knowledge-base/${kb.id}`)} className="text-[11.5px] text-primary font-medium hover:underline shrink-0">Editar</button>
                  <button onClick={() => handleToggle(kb.id)} disabled={busyId === kb.id}
                    className={cn("text-[11.5px] font-medium px-3 py-1.5 rounded-lg border shrink-0",
                      attached ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50")}>
                    {attached ? "Adjunta" : "Adjuntar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ── Bot Goals Tab ─────────────────────────────────────────
type ModalKey = "APPOINTMENT_BOOKING" | "TRIGGER_WORKFLOW" | "CONTACT_INFO" | "STOP_BOT" | "HUMAN_HANDOVER" | "TRANSFER_BOT" | "AUTO_FOLLOWUP" | "TOOLKIT" | "KNOWLEDGE_BASE" | null;

function BotGoalsTab({ agent, users, tags, workflows, otherAgents, tools, knowledgeBases }: {
  agent: Agent; users: WUser[]; tags: WTag[]; workflows: WWorkflow[]; otherAgents: OtherAgent[]; tools: AgentTool[];
  knowledgeBases: KnowledgeBaseSummary[];
}) {
  const router = useRouter();
  const [model, setModel] = useState(agent.model);
  const [prompt, setPrompt] = useState(
    () => [agent.personality, agent.goal, agent.additionalInfo].filter(Boolean).join("\n\n") ?? ""
  );
  const [actions, setActions] = useState<string[]>(agent.actions);
  const [actionsConfig, setActionsConfig] = useState<Record<string, unknown>>(agent.actionsConfig ?? {});
  const [saving, setSaving] = useState(false);
  const [openModal, setOpenModal] = useState<ModalKey>(null);
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>(agent.knowledgeBaseIds);

  const [summaryEnabled, setSummaryEnabled] = useState(agent.conversationSummaryEnabled);
  const sc = (agent.conversationSummaryConfig ?? {}) as Record<string, unknown>;
  const [inactivityValue, setInactivityValue] = useState(typeof sc.inactivityValue === "number" ? sc.inactivityValue : 15);
  const [inactivityUnit, setInactivityUnit] = useState(typeof sc.inactivityUnit === "string" ? sc.inactivityUnit : "Minutes");
  const [minMessages, setMinMessages] = useState(typeof sc.minMessages === "number" ? sc.minMessages : 3);
  const [triggerWorkflowOnSummary, setTriggerWorkflowOnSummary] = useState(Boolean(sc.triggerWorkflow));
  const [saveToCustomField, setSaveToCustomField] = useState(Boolean(sc.saveToCustomField));
  const [emailNotification, setEmailNotification] = useState(Boolean(sc.emailNotification));

  const [assignedToolIds, setAssignedToolIds] = useState<string[]>(agent.assignedToolIds ?? []);

  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatAttachment, setChatAttachment] = useState<{ url: string; kind: "image" | "pdf"; name: string } | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  // ── grabación de voz para el chat de prueba ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, chatBusy]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); if (timerRef.current) clearInterval(timerRef.current); }, []);

  function insertValue(setter: (v: string) => void, current: string, token: string) {
    setter(current ? `${current} ${token}` : token);
  }

  async function handleSave() {
    setSaving(true);
    await updateAgentGoals(agent.id, { model, personality: prompt, goal: null, additionalInfo: null, actions });
    await updateConversationSummary(agent.id, summaryEnabled, {
      inactivityValue, inactivityUnit, minMessages, triggerWorkflow: triggerWorkflowOnSummary, saveToCustomField, emailNotification,
    });
    router.refresh();
    setSaving(false);
  }

  function handlePillClick(key: string) {
    setOpenModal(key as ModalKey);
  }

  async function handleModalSave(key: string, config: Record<string, unknown>) {
    await saveActionConfig(agent.id, key, config);
    setActionsConfig((prev) => ({ ...prev, [key]: config }));
    setActions((prev) => (prev.includes(key) ? prev : [...prev, key]));
    router.refresh();
    setOpenModal(null);
  }
  async function handleRemoveAppointment() {
    await removeActionConfig(agent.id, "APPOINTMENT_BOOKING");
    setActionsConfig((prev) => { const next = { ...prev }; delete next.APPOINTMENT_BOOKING; return next; });
    setActions((prev) => prev.filter((x) => x !== "APPOINTMENT_BOOKING"));
    router.refresh();
    setOpenModal(null);
  }

  async function handleToggleTool(toolId: string) {
    const next = assignedToolIds.includes(toolId) ? assignedToolIds.filter((t) => t !== toolId) : [...assignedToolIds, toolId];
    setAssignedToolIds(next);
    await setAssignedTools(agent.id, next);
    router.refresh();
  }
  async function handleCreateCustomTool(data: { name: string; description: string; category: string; examplePrompt?: string }) {
    await createCustomTool(agent.workspaceId, data as Parameters<typeof createCustomTool>[1]);
    router.refresh();
  }
  async function handleDeleteCustomTool(toolId: string) {
    setAssignedToolIds((prev) => prev.filter((t) => t !== toolId));
    await deleteCustomTool(toolId);
    router.refresh();
  }

  async function handleToggleKnowledgeBase(id: string) {
    const next = knowledgeBaseIds.includes(id) ? knowledgeBaseIds.filter((k) => k !== id) : [...knowledgeBaseIds, id];
    setKnowledgeBaseIds(next);
    await setAgentKnowledgeBases(agent.id, next);
    router.refresh();
  }

  async function handleAttachFile(file: File) {
    setAttachBusy(true);
    setChatError("");
    const fd = new FormData();
    fd.append("file", file);
    const { uploadChatAttachment } = await import("@/app/actions/storage");
    const result = await uploadChatAttachment(fd);
    setAttachBusy(false);
    if (!result.url) { setChatError(result.error ?? "Error desconocido al subir el archivo."); return; }
    setChatAttachment({ url: result.url, kind: file.type === "application/pdf" ? "pdf" : "image", name: file.name });
  }

  async function handleSend() {
    const msg = chatInput.trim();
    if ((!msg && !chatAttachment) || chatBusy) return;
    setChatInput("");
    setChatError("");
    const displayMsg = chatAttachment ? `${msg} 📎 ${chatAttachment.name}`.trim() : msg;
    const nextHistory = [...chatHistory, { role: "user" as const, content: displayMsg }];
    setChatHistory(nextHistory);
    setChatBusy(true);
    const result = await testAgentChat(agent.id, chatHistory, msg || `(archivo adjunto: ${chatAttachment?.name})`, chatAttachment ? { url: chatAttachment.url, kind: chatAttachment.kind } : null);
    setChatAttachment(null);
    setChatBusy(false);
    if (!result.reply) { setChatError(result.error ?? "Error desconocido."); return; }
    setChatHistory([...nextHistory, { role: "assistant", content: result.reply }]);
  }

  function stopTimer() { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }
  function releaseStream() { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; }

  async function startRecording() {
    setChatError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        releaseStream();
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const { uploadVoiceNote } = await import("@/app/actions/storage");
        const fd = new FormData();
        fd.append("file", blob, `nota-voz.${mimeType.includes("webm") ? "webm" : "m4a"}`);
        setChatBusy(true);
        const uploadResult = await uploadVoiceNote(fd);
        if (!uploadResult.url) { setChatError(uploadResult.error ?? "Error desconocido."); setChatBusy(false); return; }
        const { transcribeVoiceNote } = await import("@/app/actions/ai-chat");
        const transcript = await transcribeVoiceNote(uploadResult.url);
        setChatBusy(false);
        if (!transcript.text) { setChatError(transcript.error ?? "Error desconocido."); return; }
        setChatInput(transcript.text);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setChatError("No se pudo acceder al micrófono. Verifica los permisos del navegador.");
    }
  }
  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    stopTimer();
  }

  const currentAgentSummary = { status: agent.status === "AUTO_PILOT" ? "Auto Pilot" : agent.status === "SUGGESTIVE" ? "Suggestive" : "Off", channels: agent.channels.map((c) => CHANNEL_LABEL[c]) };

  return (
    <div className="py-6 grid grid-cols-[1fr_380px] gap-5 items-start max-w-6xl mx-auto">
      {/* Left: prompt config */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold text-gray-900">Prompt</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-[11px] text-primary font-medium flex items-center gap-0.5">Add Custom Value <ChevronDown className="h-3 w-3" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CUSTOM_VALUES.map((v) => (
                <DropdownMenuItem key={v.token} onClick={() => insertValue(setPrompt, prompt, v.token)} className="text-xs">{v.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-gray-700">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {AI_MODELS[model] ?? model}
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {Object.entries(AI_MODELS).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => setModel(key)} className="text-xs justify-between">
                  {label}
                  {model === key && <Check className="h-3 w-3 ml-auto text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="You are a bot for {{ai.business_name}}, tasked to assist customers…"
          className="w-full h-[360px] border border-gray-200 rounded-lg p-3.5 text-[12.5px] outline-none resize-none text-gray-700 leading-relaxed overflow-y-auto focus:ring-1 focus:ring-primary" />
        <p className="text-[11px] text-gray-400 mt-2">A good prompt will allow the bot to better interpret and respond appropriately. <span className="text-primary">Prompt Guidelines</span></p>

        <p className="text-[12px] font-semibold text-gray-700 mt-5 mb-2">Setup your Actions</p>
        <div className="flex flex-wrap gap-2">
          {ACTION_OPTIONS.map((a) => (
            <button key={a.key} onClick={() => handlePillClick(a.key)}
              className={cn("text-[12px] font-medium px-3.5 py-2 rounded-lg border transition-colors",
                actions.includes(a.key) ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50")}>
              {a.label}
            </button>
          ))}
          <button onClick={() => setOpenModal("TOOLKIT")}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3.5 py-2 rounded-lg border border-primary bg-primary/5 text-primary transition-colors">
            <Wrench className="h-3.5 w-3.5" /> Tools &amp; APIs ({assignedToolIds.length})
          </button>
          <button onClick={() => setOpenModal("KNOWLEDGE_BASE")}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3.5 py-2 rounded-lg border border-primary bg-primary/5 text-primary transition-colors">
            <BookOpen className="h-3.5 w-3.5" /> Knowledge Base ({knowledgeBaseIds.length})
          </button>
        </div>

        {/* Preferences — Conversation Summary */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-[13px] font-semibold text-gray-800 mb-3">Preferences</p>
          <label className="flex items-center gap-2 text-[12.5px] font-medium text-gray-700 mb-3">
            <ModalToggle value={summaryEnabled} onChange={setSummaryEnabled} /> Enable Conversation Summary
          </label>
          {summaryEnabled && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-[12px] font-semibold text-gray-700 flex items-center gap-1">Conversation Summary <Info className="h-3 w-3 text-gray-300" /></p>
              <div>
                <FieldLabel required>Set Inactivity Time</FieldLabel>
                <FieldHint>A conversation summary will be generated automatically when there&apos;s no reply from the contact or the bot for the selected time.</FieldHint>
                <div className="flex gap-2 mt-1.5">
                  <TextInput type="number" min={1} value={inactivityValue} onChange={(e) => setInactivityValue(Number(e.target.value))} className="w-24" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-gray-600 flex items-center gap-1.5">{inactivityUnit} <ChevronDown className="h-3.5 w-3.5" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {["Minutes", "Hours"].map((u) => <DropdownMenuItem key={u} onClick={() => setInactivityUnit(u)} className="text-xs">{u}</DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div>
                <FieldLabel required>Minimum Messages required to generate Summary</FieldLabel>
                <FieldHint>A conversation summary is generated when there&apos;s no activity for the set time and the conversation has at least the minimum number of messages configured.</FieldHint>
                <div className="flex items-center gap-1 mt-1.5">
                  <TextInput type="number" min={1} value={minMessages} onChange={(e) => setMinMessages(Number(e.target.value))} className="w-20 text-center" />
                  <button onClick={() => setMinMessages((v) => Math.max(1, v - 1))} className="h-9 w-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">−</button>
                  <button onClick={() => setMinMessages((v) => v + 1)} className="h-9 w-9 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">+</button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-gray-700"><input type="checkbox" checked={triggerWorkflowOnSummary} onChange={(e) => setTriggerWorkflowOnSummary(e.target.checked)} className="accent-primary h-3.5 w-3.5" /> Trigger a workflow when summary or transcript is generated</label>
              <label className="flex items-center gap-2 text-[12px] text-gray-700"><input type="checkbox" checked={saveToCustomField} onChange={(e) => setSaveToCustomField(e.target.checked)} className="accent-primary h-3.5 w-3.5" /> Save to custom field</label>
              <label className="flex items-center gap-2 text-[12px] text-gray-700"><ModalToggle value={emailNotification} onChange={setEmailNotification} /> Receive email notification for conversation summary</label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={() => router.push("/agentes")}>Cancel</Button>
          <Button size="sm" disabled={saving} onClick={handleSave}>{saving ? "Guardando…" : "Save"}</Button>
        </div>
      </div>

      {/* Right: Test Your Bot */}
      <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-[640px] sticky top-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-gray-800">
            <Sparkles className="h-4 w-4 text-primary" /> Test Your Bot
          </span>
          <button onClick={() => { setChatHistory([]); setChatError(""); setChatAttachment(null); }} title="Reiniciar" className="text-gray-400 hover:text-gray-700">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatHistory.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-gray-300">
              <Sparkles className="h-8 w-8" />
              <p className="text-[12px] text-gray-400 max-w-[220px]">Envía un mensaje para probar cómo responde tu bot con el prompt actual. Puedes adjuntar imágenes, PDFs o notas de voz.</p>
            </div>
          )}
          {chatHistory.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-[12.5px] leading-relaxed",
                m.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm")}>
                {m.content}
              </div>
            </div>
          ))}
          {chatBusy && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
              </div>
            </div>
          )}
          {chatError && (
            <p className="text-[11px] text-red-500 flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3 w-3 shrink-0" /> {chatError}
            </p>
          )}
          <div ref={chatEndRef} />
        </div>

        {chatAttachment && (
          <div className="flex items-center gap-2 px-3 pt-2">
            <span className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-[11px] px-2 py-1 rounded-full">
              <FileIcon className="h-3 w-3" /> {chatAttachment.name}
              <button onClick={() => setChatAttachment(null)} className="hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
            </span>
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-2.5 px-3 py-3 border-t border-gray-100">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-[13px] font-medium text-gray-700 flex-1">Grabando… {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}</span>
            <button onClick={stopRecording} className="p-1.5 rounded-full bg-primary text-white"><Square className="h-3.5 w-3.5 fill-current" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 border-t border-gray-100">
            <input ref={attachInputRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleAttachFile(e.target.files[0]); e.target.value = ""; }} />
            <button onClick={() => attachInputRef.current?.click()} disabled={attachBusy} title="Adjuntar imagen o PDF"
              className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary hover:bg-gray-50 shrink-0 disabled:opacity-50">
              {attachBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <button onClick={startRecording} title="Grabar nota de voz" className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary hover:bg-gray-50 shrink-0">
              <Mic className="h-4 w-4" />
            </button>
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
              placeholder="Send a message" disabled={chatBusy}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-primary disabled:opacity-60" />
            <button onClick={handleSend} disabled={chatBusy || (!chatInput.trim() && !chatAttachment)}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-primary/90 shrink-0">
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {openModal === "APPOINTMENT_BOOKING" && (
        <AppointmentBookingModal
          initial={actionsConfig.APPOINTMENT_BOOKING as never}
          workflows={workflows}
          otherAgents={otherAgents}
          hasExisting={actions.includes("APPOINTMENT_BOOKING")}
          onClose={() => setOpenModal(null)}
          onRemove={handleRemoveAppointment}
          onSave={(c) => handleModalSave("APPOINTMENT_BOOKING", c)}
        />
      )}
      {openModal === "TRIGGER_WORKFLOW" && (
        <TriggerWorkflowModal
          initial={actionsConfig.TRIGGER_WORKFLOW as never}
          workflows={workflows}
          onClose={() => setOpenModal(null)}
          onSave={(c) => handleModalSave("TRIGGER_WORKFLOW", c)}
        />
      )}
      {openModal === "CONTACT_INFO" && (
        <ContactInfoModal
          initial={actionsConfig.CONTACT_INFO as never}
          onClose={() => setOpenModal(null)}
          onSave={(c) => handleModalSave("CONTACT_INFO", c)}
        />
      )}
      {openModal === "STOP_BOT" && (
        <StopBotModal
          initial={actionsConfig.STOP_BOT as never}
          tags={tags}
          onClose={() => setOpenModal(null)}
          onSave={(c) => handleModalSave("STOP_BOT", c)}
        />
      )}
      {openModal === "HUMAN_HANDOVER" && (
        <HumanHandoverModal
          initial={actionsConfig.HUMAN_HANDOVER as never}
          users={users}
          tags={tags}
          onClose={() => setOpenModal(null)}
          onSave={(c) => handleModalSave("HUMAN_HANDOVER", c)}
        />
      )}
      {openModal === "TRANSFER_BOT" && (
        <BotTransferModal
          initial={actionsConfig.TRANSFER_BOT as never}
          otherAgents={otherAgents}
          currentAgentSummary={currentAgentSummary}
          onClose={() => setOpenModal(null)}
          onSave={(c) => handleModalSave("TRANSFER_BOT", c)}
        />
      )}
      {openModal === "AUTO_FOLLOWUP" && (
        <AutoFollowupModal
          initial={actionsConfig.AUTO_FOLLOWUP as never}
          onClose={() => setOpenModal(null)}
          onSave={(c) => handleModalSave("AUTO_FOLLOWUP", c)}
        />
      )}
      {openModal === "TOOLKIT" && (
        <ToolKitModal
          tools={tools}
          assignedIds={assignedToolIds}
          onClose={() => setOpenModal(null)}
          onToggleAssign={handleToggleTool}
          onCreateCustom={handleCreateCustomTool}
          onDeleteCustom={handleDeleteCustomTool}
        />
      )}
      {openModal === "KNOWLEDGE_BASE" && (
        <KnowledgeBaseModal
          workspaceId={agent.workspaceId}
          knowledgeBases={knowledgeBases}
          assignedIds={knowledgeBaseIds}
          onClose={() => setOpenModal(null)}
          onToggleAssign={handleToggleKnowledgeBase}
        />
      )}
    </div>
  );
}

// ── Dashboard Tab (scoped to this agent) ──────────────────
function AgentDashboardTab({ agent }: { agent: Agent }) {
  return (
    <div className="max-w-4xl mx-auto py-6 space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[
          ["Total Unique Contacts", null],
          ["Total Actions Triggered", null],
          ["Total Appointment Booked", null],
          ["Time Saved", null],
        ].map(([label]) => (
          <div key={label} className="border border-gray-200 rounded-xl p-4 bg-white">
            <p className="text-[12px] text-gray-500 font-medium mb-2">{label}</p>
            <p className="text-[26px] font-bold text-gray-900">-</p>
            <p className="text-[11px] text-gray-400 mt-1">Data for the selected timeframe isn&apos;t available.</p>
          </div>
        ))}
      </div>
      <div className="border border-gray-200 rounded-xl bg-white p-5">
        <p className="text-[13px] font-semibold text-gray-700 mb-2">Base de conocimiento</p>
        <p className="text-[12px] text-gray-500">{agent.knowledgeBaseIds.length} base{agent.knowledgeBaseIds.length !== 1 ? "s" : ""} de conocimiento adjunta{agent.knowledgeBaseIds.length !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export function AgentEditorClient({ agent, workspaceName, otherAgents, users, tags, workflows, tools, knowledgeBases }: {
  agent: Agent; workspaceName: string; otherAgents: OtherAgent[]; users: WUser[]; tags: WTag[]; workflows: WWorkflow[]; tools: AgentTool[];
  knowledgeBases: KnowledgeBaseSummary[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<"settings" | "goals" | "dashboard">(
    initialTab === "goals" ? "goals" : initialTab === "dashboard" ? "dashboard" : "settings"
  );

  const TABS: { key: typeof tab; label: string }[] = [
    { key: "settings", label: "Bot Settings" },
    { key: "goals", label: "Bot Goals" },
    { key: "dashboard", label: "Dashboard" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F5F5F5] overflow-y-auto">
      <div className="bg-white border-b border-gray-100 px-6 pt-5">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => router.push("/agentes")} className="text-gray-400 hover:text-gray-600 text-[13px]">Agentes de IA</button>
          <span className="text-gray-300">/</span>
        </div>
        <h1 className="text-[22px] font-bold text-gray-900">{agent.name}</h1>
        <p className="text-[13px] text-gray-400 mb-4">Unlock the power of automated conversations</p>
        <div className="flex items-center gap-5">
          {TABS.map((t) => (
            <button key={t.key} id={t.key === "goals" ? "tab-goals-btn" : undefined} onClick={() => setTab(t.key)}
              className={cn("text-[13px] font-medium pb-2.5 border-b-2 -mb-px transition-colors",
                tab === t.key ? "text-primary border-primary" : "text-gray-500 border-transparent hover:text-gray-700")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6">
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>
          {tab === "settings" && <BotSettingsTab agent={agent} workspaceName={workspaceName} onSaved={() => {}} />}
          {tab === "goals" && <BotGoalsTab agent={agent} users={users} tags={tags} workflows={workflows} otherAgents={otherAgents} tools={tools} knowledgeBases={knowledgeBases} />}
          {tab === "dashboard" && <AgentDashboardTab agent={agent} />}
        </motion.div>
      </div>
    </div>
  );
}
