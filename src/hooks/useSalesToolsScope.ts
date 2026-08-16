import { useCallback, useState } from "react";

import { useAuth } from "@/features/auth/AuthContext";
import { canSell, canSuperviseSalesReps } from "@/lib/roles";

export type SalesToolsScope = "own" | "team";

export function useSalesToolsScope() {
  const { user } = useAuth();
  const canSupervise = canSuperviseSalesReps(user);
  const canSellTools = canSell(user);
  const [scope, setScopeState] = useState<SalesToolsScope>("own");

  const viewingTeam = canSupervise && (!canSellTools || scope === "team");
  const viewingOwn = canSellTools && (!canSupervise || scope === "own");
  const showToggle = canSellTools && canSupervise;

  const setScope = useCallback((next: SalesToolsScope) => {
    setScopeState(next);
  }, []);

  return {
    scope,
    setScope,
    viewingTeam,
    viewingOwn,
    showToggle,
    canSellTools,
    canSupervise,
  };
}
