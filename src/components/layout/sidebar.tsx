"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  Users,
  CalendarDays,
  CheckSquare,
  Megaphone,
  Bot,
  Zap,
  Plug,
  Settings,
  Search,
  Command,
  ShieldCheck,
  DollarSign,
  FileCheck,
  FileText,
  Globe,
  UserCheck,
  FileSignature,
  FolderOpen,
  Handshake,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { useUnreadConversationsBadge } from "@/components/layout/unread-badge-context";

type NavItemDef = { label: string; href: string; icon: React.ElementType; badge?: number };
type NavGroup = { label: string; items: NavItemDef[] };

function buildNavGroups(badges: { unreadConversaciones: number; pendingTasks: number }): NavGroup[] {
  return [
    {
      label: "CRM",
      items: [
        { label: "Conversaciones", href: "/conversaciones", icon: MessageSquare, badge: badges.unreadConversaciones || undefined },
        { label: "Negocios",       href: "/negocios",       icon: Kanban },
        { label: "Calendario",     href: "/calendarios",    icon: CalendarDays },
        { label: "Tareas",         href: "/tareas",         icon: CheckSquare, badge: badges.pendingTasks || undefined },
        { label: "Leads",          href: "/leads",          icon: Users },
      ],
    },
    {
      label: "Propiedades",
      items: [
        { label: "Catálogo",     href: "/inventario",  icon: Building2 },
        { label: "Página Web",   href: "/pagina-web",  icon: Globe },
      ],
    },
    {
      label: "Operaciones",
      items: [
        { label: "Debida Diligencia",              href: "/debida-diligencia", icon: UserCheck },
        { label: "Cotización",                     href: "/cotizaciones",      icon: FileText },
        { label: "Contratos",                       href: "/contratos",         icon: FileSignature },
        { label: "Orden de Venta",                  href: "/ordenes-venta",     icon: FileCheck },
        { label: "Documentos Digitales",            href: "/documentos",        icon: FolderOpen },
        { label: "Control de Trámites",             href: "/tramites",          icon: Handshake },
      ],
    },
    {
      label: "Finanzas",
      items: [
        { label: "Comisiones", href: "/comisiones", icon: DollarSign },
      ],
    },
  ];
}

const adminItems: NavItemDef[] = [
  { label: "Agentes de IA",      href: "/agentes",          icon: Bot },
  { label: "Automatizaciones",   href: "/automatizaciones", icon: Zap },
  { label: "Campañas",           href: "/campanas",         icon: Megaphone },
  { label: "Integraciones",      href: "/integraciones",    icon: Plug },
];

type SidebarBadges = { unreadConversaciones: number; pendingTasks: number };
type SidebarUser = { name: string; role: string } | null;

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Administrador", AGENTE: "Agente" };

type SidebarWorkspace = { id: string; name: string; slug: string; logoUrl: string | null };
type SidebarWorkspaceListItem = SidebarWorkspace & { isActive: boolean; plan: string };

export function Sidebar({ badges, currentUser, workspace, allWorkspaces, isSuperAdmin }: {
  badges?: SidebarBadges; currentUser?: SidebarUser;
  workspace?: SidebarWorkspace; allWorkspaces?: SidebarWorkspaceListItem[] | null;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [, setSearchOpen] = useState(false);
  // El de Conversaciones viene del contexto (se actualiza al instante al abrir un chat);
  // el resto de badges sigue viniendo del servidor tal cual.
  const { count: liveUnreadConversaciones } = useUnreadConversationsBadge();
  const navGroups = buildNavGroups({
    ...(badges ?? { unreadConversaciones: 0, pendingTasks: 0 }),
    unreadConversaciones: liveUnreadConversaciones,
  });

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo + Workspace selector */}
      <div className="border-b border-sidebar-border px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            Brokealty CRM
          </span>
        </div>

        {/* Workspace selector */}
        {workspace && (
          <WorkspaceSwitcher
            workspace={workspace}
            allWorkspaces={allWorkspaces ?? null}
            roleLabel={currentUser ? (ROLE_LABEL[currentUser.role] ?? currentUser.role) : ""}
          />
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
        >
          <Search className="h-3 w-3" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="flex items-center gap-0.5 rounded bg-background px-1 py-0.5 text-[10px] border border-border">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <ul className="space-y-0.5">
          <NavItem item={{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }} pathname={pathname} />
        </ul>

        {navGroups.map((group) => (
          <NavSection key={group.label} label={group.label} items={group.items} pathname={pathname} />
        ))}

        <NavSection label="Admin" items={adminItems} pathname={pathname} />

        {isSuperAdmin && (
          <NavSection label="Super Admin" items={[{ label: "Super Admin", href: "/super-admin", icon: ShieldCheck }]} pathname={pathname} />
        )}

        <NavSection label="Configuración" items={[{ label: "Configuración", href: "/configuracion", icon: Settings }]} pathname={pathname} />
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[11px] bg-muted">
                {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{currentUser?.name ?? "Sin sesión"}</p>
            <p className="text-[10px] text-muted-foreground">{currentUser ? (ROLE_LABEL[currentUser.role] ?? currentUser.role) : ""}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavSection({ label, items, pathname }: { label: string; items: NavItemDef[]; pathname: string }) {
  return (
    <>
      <div className="mt-3 mb-1 px-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </>
  );
}

interface NavItemProps {
  item: NavItemDef;
  pathname: string;
}

function NavItem({ item, pathname }: NavItemProps) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {isActive && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-md bg-sidebar-accent"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Icon className={cn("relative h-4 w-4 shrink-0", isActive && "text-primary")} />
        <span className="relative flex-1 text-[13px]">{item.label}</span>
        {item.badge && (
          <span className="relative flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
