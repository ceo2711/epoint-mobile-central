import type {
  ProspectCalendlyBrief,
  ProspectEnvelopeBrief,
  ProspectHistoryEntry,
  ProspectPaymentBrief,
  ProspectStatus,
} from "@/types/api";

const CONTACT_DONE_STATUSES = new Set<string>([
  "LEAD_CONTACTADO",
  "CONTRATO_ENVIADO",
]);

export function sellerMarkedContacted(
  status: string,
  history?: ProspectHistoryEntry[] | null,
): boolean {
  if (CONTACT_DONE_STATUSES.has(status)) return true;
  return Boolean(history?.some((entry) => entry.to_status === "LEAD_CONTACTADO"));
}

export function isMeetingStepComplete(
  _calendly: ProspectCalendlyBrief | null,
  status: string,
  history?: ProspectHistoryEntry[] | null,
): boolean {
  return sellerMarkedContacted(status, history);
}

export function findContactHistory(
  history: ProspectHistoryEntry[] | null | undefined,
): ProspectHistoryEntry | null {
  if (!history?.length) return null;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry.to_status === "LEAD_CONTACTADO" && entry.note?.trim()) {
      return entry;
    }
  }
  return null;
}

export function isContractStepComplete(envelopes: ProspectEnvelopeBrief[]): boolean {
  return envelopes.some((envelope) => {
    const status = envelope.status.toLowerCase();
    return status === "completed" || status === "signed";
  });
}

export function isPaymentStepComplete(
  payment: ProspectPaymentBrief | null,
  payments: ProspectPaymentBrief[] = [],
): boolean {
  if (payments.some((item) => item.status?.toLowerCase() === "paid")) return true;
  return payment?.status?.toLowerCase() === "paid";
}

export function pickPreferredPayment(
  payment: ProspectPaymentBrief | null,
  payments: ProspectPaymentBrief[] = [],
): ProspectPaymentBrief | null {
  const list = payments.length > 0 ? payments : payment ? [payment] : [];
  if (list.length === 0) return null;
  return (
    list.find((item) => item.status?.toLowerCase() === "paid") ??
    list.find((item) => item.status?.toLowerCase() === "pending") ??
    payment ??
    list[0] ??
    null
  );
}

export function isReadyForClientConversion(
  calendly: ProspectCalendlyBrief | null,
  status: ProspectStatus | string,
  envelopes: ProspectEnvelopeBrief[],
  payment: ProspectPaymentBrief | null,
  payments: ProspectPaymentBrief[] = [],
  history?: ProspectHistoryEntry[] | null,
): boolean {
  return (
    isMeetingStepComplete(calendly, status, history) &&
    isContractStepComplete(envelopes) &&
    isPaymentStepComplete(payment, payments)
  );
}
