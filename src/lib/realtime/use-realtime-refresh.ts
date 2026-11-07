"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Suscripción en tiempo real a cambios de `messages`/`conversations` vía SSE
 * (/api/realtime, alimentado por Postgres LISTEN/NOTIFY). En cada evento llama a
 * `router.refresh()`, que recalcula los Server Components de la ruta actual: un solo
 * montaje en el layout del dashboard mantiene al día el badge de "Conversaciones" y,
 * si el usuario está en esa pantalla, la lista y el chat abiertos.
 *
 * EventSource reconecta solo. Los eventos en ráfaga se agrupan (debounce) para no
 * disparar un refresh por mensaje, y al volver a la pestaña se pone al día.
 */
export function useRealtimeConversationsRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    const source = new EventSource("/api/realtime");
    source.onmessage = refreshSoon;

    function onWake() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);

    return () => {
      if (timer) clearTimeout(timer);
      source.close();
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
