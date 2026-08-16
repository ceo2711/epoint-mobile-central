import { api } from "@/lib/api";
import type { Paginated, PaymentLink } from "@/types/api";

export const PAYMENTS_PAGE_SIZE = 10;
export const LINKABLE_PAYMENTS_LIMIT = 100;

export function asPaymentList(
  data: PaymentLink[] | Paginated<PaymentLink> | null | undefined,
): PaymentLink[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export function isLinkableExistingPayment(
  link: Pick<PaymentLink, "status" | "prospect_id">,
): boolean {
  return link.status === "pending" && !link.prospect_id;
}

export async function fetchLinkablePaymentLinks(
  token: string,
  email: string,
): Promise<PaymentLink[]> {
  const params = new URLSearchParams({
    page: "1",
    page_size: String(LINKABLE_PAYMENTS_LIMIT),
    status: "pending",
    unlinked: "true",
    customer_email: email.trim().toLowerCase(),
  });
  const data = await api.get<Paginated<PaymentLink>>(`/payments/links?${params}`, token);
  return asPaymentList(data).filter(isLinkableExistingPayment);
}
