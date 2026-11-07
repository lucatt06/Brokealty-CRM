"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRealtimeConversationsRefresh } from "@/lib/realtime/use-realtime-refresh";

type UnreadBadgeContextValue = {
  count: number;
  /** Baja el contador en 1 al instante, sin esperar el refresh del servidor. */
  decrement: () => void;
};

const UnreadBadgeContext = createContext<UnreadBadgeContextValue | null>(null);

// El contador real vive en el servidor (layout.tsx lo recalcula en cada
// router.refresh()); este provider solo permite adelantarse a esa vuelta
// para que el badge desaparezca en el mismo instante en que se abre el chat,
// en vez de esperar el round-trip de red.
export function UnreadBadgeProvider({ initialCount, children }: { initialCount: number; children: React.ReactNode }) {
  const [count, setCount] = useState(initialCount);
  const prevInitial = useRef(initialCount);

  // Este provider vive en el layout del dashboard, montado en TODA pantalla —
  // por eso es el lugar correcto para la suscripción de tiempo real: así el
  // badge (y, si el usuario está en Conversaciones, la página misma vía
  // router.refresh()) se actualiza sin importar en qué parte del CRM esté.
  useRealtimeConversationsRefresh();

  useEffect(() => {
    if (initialCount !== prevInitial.current) {
      prevInitial.current = initialCount;
      setCount(initialCount);
    }
  }, [initialCount]);

  const decrement = useCallback(() => {
    setCount((c) => Math.max(0, c - 1));
  }, []);

  return (
    <UnreadBadgeContext.Provider value={{ count, decrement }}>
      {children}
    </UnreadBadgeContext.Provider>
  );
}

export function useUnreadConversationsBadge() {
  const ctx = useContext(UnreadBadgeContext);
  if (!ctx) throw new Error("useUnreadConversationsBadge debe usarse dentro de UnreadBadgeProvider");
  return ctx;
}
