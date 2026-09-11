import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import * as Notifications from "expo-notifications";
import {
  getActiveSessionsForHost,
  connectSessionSocket,
  respondToExtensionRequest,
  HostActiveSession,
  ExtensionRequestEvent,
} from "@/api/sessions";

export interface HostSessionState {
  sessionId: number;
  kwh: number;
  seconds: number;
  pendingExtension: ExtensionRequestEvent | null;
}

/**
 * Host-side live session visibility — deliberately a separate mechanism
 * from SessionContext, not an extension of it. SessionContext answers "is
 * *this signed-in account* currently driving a session" (this device's
 * own socket, one session at a time); a host needs "is anyone currently
 * charging at *any charger I own*" — a real, server-discovered fact about
 * someone else's session, on a separate account/device entirely, and
 * potentially more than one at once (one per charger).
 *
 * This is discovery-only glue: GET /sessions/active-for-host (real
 * ownerId-scoped discovery — see SessionsService.getActiveSessionsForHost)
 * to find out what's running, then connectSessionSocket — the exact same,
 * already-proven multi-subscriber function SessionContext itself uses,
 * completely unmodified — to join each session's room. SessionsGateway
 * already authorizes either the session's driver or the charger's owner
 * for that same room, so nothing server-side needed to change to let a
 * host listen in.
 *
 * Keyed by chargerId (what MyChargersScreen renders per-card), not
 * sessionId — a charger can only ever have one active session at a time
 * (a booking has at most one Session row), so this 1:1 assumption is
 * real, not a simplification.
 */
export function useHostActiveSessions() {
  const [sessions, setSessions] = useState<Map<number, HostSessionState>>(new Map());
  const socketsRef = useRef<Map<number, Socket>>(new Map()); // sessionId -> socket
  const chargerBySessionRef = useRef<Map<number, number>>(new Map()); // sessionId -> chargerId

  const disconnectSession = useCallback((sessionId: number) => {
    socketsRef.current.get(sessionId)?.disconnect();
    socketsRef.current.delete(sessionId);
    chargerBySessionRef.current.delete(sessionId);
  }, []);

  const connectDiscovered = useCallback((discovered: HostActiveSession) => {
    if (socketsRef.current.has(discovered.sessionId)) return; // already connected — refresh() re-discovers, doesn't re-subscribe
    chargerBySessionRef.current.set(discovered.sessionId, discovered.chargerId);

    const socket = connectSessionSocket(
      discovered.sessionId,
      (tick) => {
        setSessions((prev) => {
          const chargerId = chargerBySessionRef.current.get(discovered.sessionId);
          const current = chargerId !== undefined ? prev.get(chargerId) : undefined;
          if (chargerId === undefined || !current) return prev;
          const next = new Map(prev);
          next.set(chargerId, { ...current, kwh: tick.kwh, seconds: tick.seconds });
          return next;
        });
      },
      () => {
        // session:ended — this charger genuinely has nothing active
        // anymore; same room every subscriber (driver and host alike)
        // already gets this from, see SessionsGateway.
        const chargerId = chargerBySessionRef.current.get(discovered.sessionId);
        disconnectSession(discovered.sessionId);
        if (chargerId !== undefined) {
          setSessions((prev) => {
            const next = new Map(prev);
            next.delete(chargerId);
            return next;
          });
        }
      },
      (extEvent) => {
        const chargerId = chargerBySessionRef.current.get(discovered.sessionId);
        if (chargerId === undefined) return;
        setSessions((prev) => {
          const current = prev.get(chargerId);
          if (!current) return prev;
          const next = new Map(prev);
          next.set(chargerId, { ...current, pendingExtension: extEvent.status === "pending" ? extEvent : null });
          return next;
        });
      },
    );
    socketsRef.current.set(discovered.sessionId, socket);

    setSessions((prev) => {
      const next = new Map(prev);
      next.set(discovered.chargerId, {
        sessionId: discovered.sessionId,
        kwh: discovered.kwh,
        seconds: discovered.seconds,
        pendingExtension: discovered.pendingExtension,
      });
      return next;
    });
  }, [disconnectSession]);

  // The one-time discovery call MyChargersScreen fires on focus — see its
  // own useFocusEffect. Reconciles against whatever's currently connected:
  // joins any newly-discovered session's room, and drops tracking for any
  // charger that no longer has one (covers a session that ended while this
  // screen wasn't focused to receive the session:ended broadcast itself).
  const refresh = useCallback(async () => {
    let discovered: HostActiveSession[];
    try {
      discovered = await getActiveSessionsForHost();
    } catch {
      // A transient failure here just means this refresh cycle found
      // nothing new — whatever's already connected and ticking keeps
      // ticking regardless, same as every other "leave prior state alone
      // on a failed refetch" pattern already used on this screen.
      return;
    }

    const discoveredSessionIds = new Set(discovered.map((d) => d.sessionId));
    for (const sessionId of Array.from(socketsRef.current.keys())) {
      if (!discoveredSessionIds.has(sessionId)) {
        const chargerId = chargerBySessionRef.current.get(sessionId);
        disconnectSession(sessionId);
        if (chargerId !== undefined) {
          setSessions((prev) => {
            const next = new Map(prev);
            next.delete(chargerId);
            return next;
          });
        }
      }
    }

    discovered.forEach(connectDiscovered);
  }, [connectDiscovered, disconnectSession]);

  // A real notification arriving while this screen is already open and
  // focused — the case a one-time focus-fetch alone would miss (a session
  // starting after the host already landed here). Reuses the exact push
  // channel NotificationsService already sends extension_requested/
  // booking_created through (see notifications.service.ts's
  // session.started handler) rather than polling on an interval:
  // discovery here is a genuinely rare, discrete event (a driver starting
  // a session), not a continuously-changing value, so an always-on poll
  // would mostly fire for nothing — this only ever calls refresh() when
  // there's an actual reason to. The narrow gap this leaves (push
  // permission denied, and the host never leaves/reopens this screen) is
  // the same one every other host-facing trigger here already has, not a
  // new one.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { type?: string } | undefined;
      if (data?.type === "session_started") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  // Sessions discovered by this hook are this screen's own subscriptions
  // — nothing else holds a reference to these sockets, so they need to be
  // torn down here specifically, the same reasoning SessionContext's own
  // unmount-time disconnect already documents.
  useEffect(() => {
    return () => {
      socketsRef.current.forEach((socket) => socket.disconnect());
      socketsRef.current.clear();
      chargerBySessionRef.current.clear();
    };
  }, []);

  const respondToExtension = useCallback(
    async (chargerId: number, approve: boolean) => {
      const pending = sessions.get(chargerId)?.pendingExtension;
      if (!pending) {
        throw new Error("respondToExtension() called with no pending request for this charger");
      }
      // Fire-and-forget, same as SessionContext's own respondToExtension —
      // the extension:approved/declined event coming back over the socket
      // is what actually updates pendingExtension, not this call's return.
      await respondToExtensionRequest(pending.id, approve);
    },
    [sessions],
  );

  return { sessions, refresh, respondToExtension };
}
