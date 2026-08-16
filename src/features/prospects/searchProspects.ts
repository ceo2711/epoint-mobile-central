import { api } from "@/lib/api";
import type { Paginated, Prospect } from "@/types/api";

export const PROSPECT_SEARCH_LIMIT = 20;

export type ProspectSearchResponse = {
  items: Prospect[];
  total: number;
};

export async function searchProspects(
  token: string,
  query: string,
): Promise<ProspectSearchResponse> {
  const params = new URLSearchParams({
    search: query,
    page: "1",
    page_size: String(PROSPECT_SEARCH_LIMIT),
  });
  const data = await api.get<Paginated<Prospect>>(
    `/prospects?${params.toString()}`,
    token,
  );
  return { items: data.items, total: data.total };
}
