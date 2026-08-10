import { api } from "@/lib/api";
import type { CalendlySalesRep, Paginated, Sede } from "@/types/api";

export async function fetchSedes(
  token: string,
  opts?: { includeInactive?: boolean },
): Promise<Sede[]> {
  const params = new URLSearchParams();
  if (opts?.includeInactive) params.set("include_inactive", "true");
  const qs = params.toString();
  const data = await api.get<Sede[] | Paginated<Sede>>(
    `/sedes${qs ? `?${qs}` : ""}`,
    token,
  );
  return Array.isArray(data) ? data : data.items;
}

export async function fetchCalendlySalesReps(
  token: string,
  sedeId?: number | null,
): Promise<CalendlySalesRep[]> {
  const params = new URLSearchParams();
  if (sedeId != null) params.set("sede_id", String(sedeId));
  const qs = params.toString();
  return api.get<CalendlySalesRep[]>(
    `/calendly/sales-reps${qs ? `?${qs}` : ""}`,
    token,
  );
}

export function buildScopeQuery(opts: {
  sedeId?: number | null;
  salesRepId?: number | null;
}): string {
  const params = new URLSearchParams();
  if (opts.sedeId != null) params.set("sede_id", String(opts.sedeId));
  if (opts.salesRepId != null) params.set("sales_rep_id", String(opts.salesRepId));
  return params.toString();
}
