import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/AuthContext";
import {
  buildSedeBranchesFromReps,
  filterRepsBySede,
  type SedeBranchCard,
} from "@/features/sedes/utils/sedeBranches";
import { canFilterClientsBySalesRep, canSuperviseSalesReps, isGlobalAdmin } from "@/lib/roles";
import {
  fetchCalendlySalesReps,
  fetchSedes,
} from "@/lib/staffScope";
import type { CalendlySalesRep, Sede, SedeBrief } from "@/types/api";

type UseAdminSedeScopeOptions = {
  /** Si false, no carga catálogo (p.ej. usuario no-admin). Default true. */
  enabled?: boolean;
  /** También cargar vendedores (calendario/contratos/pagos). Default true. */
  loadReps?: boolean;
  /** Si se pasa, fuerza si hay que elegir vendedor. Default: canSupervise. */
  pickRep?: boolean;
};

export function useAdminSedeScope(options?: UseAdminSedeScopeOptions) {
  const enabled = options?.enabled ?? true;
  const loadReps = options?.loadReps ?? true;
  const { token, user, hasPermission } = useAuth();
  const isGlobal = isGlobalAdmin(user?.role.code);
  const canSupervise = canSuperviseSalesReps(user);
  const canFilterReps = canFilterClientsBySalesRep(user);
  /** Admin, gerente o jefe de ventas: hay que elegir un vendedor (salvo herramientas propias). */
  const needsRepPicker = options?.pickRep ?? canSupervise;

  const [selectedSedeId, setSelectedSedeId] = useState<number | null>(null);
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [salesReps, setSalesReps] = useState<CalendlySalesRep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldLoadSedes = Boolean(enabled && isGlobal && token);
  const shouldLoadReps = Boolean(
    enabled && loadReps && token && (isGlobal || canFilterReps),
  );
  const shouldLoad = shouldLoadSedes || shouldLoadReps;

  const reload = useCallback(async () => {
    if (!token || !shouldLoad) {
      setSedes([]);
      setSalesReps([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const canReadSedes = shouldLoadSedes && hasPermission("sedes:read");
      const [sedeList, reps] = await Promise.all([
        canReadSedes ? fetchSedes(token) : Promise.resolve([] as Sede[]),
        shouldLoadReps
          ? fetchCalendlySalesReps(token)
          : Promise.resolve([] as CalendlySalesRep[]),
      ]);
      setSedes(sedeList);
      setSalesReps(reps);
    } catch {
      setError("scope.loadError");
      setSedes([]);
      setSalesReps([]);
    } finally {
      setLoading(false);
    }
  }, [token, shouldLoad, shouldLoadSedes, shouldLoadReps, hasPermission]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const branches: SedeBranchCard[] = useMemo(
    () =>
      buildSedeBranchesFromReps(salesReps, sedes, {
        includeAllSedes: true,
        fallbackName: "Sede",
      }),
    [salesReps, sedes],
  );

  const selectedSede = useMemo(
    () => branches.find((b) => b.id === selectedSedeId) ?? null,
    [branches, selectedSedeId],
  );

  const ownSede: SedeBrief | null = user?.sede ?? null;

  const repsForSelectedSede = useMemo(
    () =>
      filterRepsBySede(salesReps, selectedSedeId, {
        filterBySede: isGlobal,
      }),
    [salesReps, selectedSedeId, isGlobal],
  );

  const selectedRep = useMemo(
    () => salesReps.find((r) => r.id === selectedRepId) ?? null,
    [salesReps, selectedRepId],
  );

  const showSedePicker = isGlobal && selectedSedeId === null;
  const showRepPicker =
    needsRepPicker &&
    selectedRepId === null &&
    (!isGlobal || selectedSedeId != null);

  const selectSede = useCallback((id: number) => {
    setSelectedSedeId(id);
    setSelectedRepId(null);
  }, []);

  const clearSede = useCallback(() => {
    setSelectedSedeId(null);
    setSelectedRepId(null);
  }, []);

  const selectRep = useCallback((id: number) => {
    setSelectedRepId(id);
  }, []);

  const clearRep = useCallback(() => {
    setSelectedRepId(null);
  }, []);

  return {
    isGlobal,
    canSupervise,
    needsRepPicker,
    showSedePicker,
    showRepPicker,
    selectedSedeId,
    selectedRepId,
    selectedSede,
    selectedRep,
    ownSede,
    branches,
    salesReps,
    repsForSelectedSede,
    loading,
    error,
    selectSede,
    clearSede,
    selectRep,
    clearRep,
    reload,
  };
}
