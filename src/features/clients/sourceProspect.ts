import type {
  ClientSourceProspect,
  ProspectCalendlyBrief,
  ProspectEnvelopeBrief,
  ProspectHistoryEntry,
  ProspectPaymentBrief,
} from "@/types/api";

export type ClientPipeline = {
  prospectId: number | null;
  status: string;
  isQualified: boolean;
  history: ProspectHistoryEntry[];
  calendly: ProspectCalendlyBrief | null;
  envelopes: ProspectEnvelopeBrief[];
  payment: ProspectPaymentBrief | null;
  payments: ProspectPaymentBrief[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asEnvelope(raw: unknown): ProspectEnvelopeBrief | null {
  const row = asRecord(raw);
  if (!row || !row.id) return null;
  return {
    id: num(row.id),
    subject: str(row.subject, "Contrato"),
    status: str(row.status),
    signer_name: str(row.signer_name) || undefined,
    signer_email: str(row.signer_email) || undefined,
    sent_at: str(row.sent_at),
    completed_at: row.completed_at ? str(row.completed_at) : null,
  };
}

function asPayment(raw: unknown): ProspectPaymentBrief | null {
  const row = asRecord(raw);
  if (!row || !row.id) return null;
  return {
    id: num(row.id),
    amount: str(row.amount, "0"),
    currency: str(row.currency, "USD"),
    status: str(row.status),
    payment_url: str(row.payment_url),
    paid_at: row.paid_at ? str(row.paid_at) : null,
    created_at: row.created_at ? str(row.created_at) : undefined,
  };
}

function asCalendly(raw: unknown): ProspectCalendlyBrief | null {
  const row = asRecord(raw);
  if (!row || !row.id) return null;
  return {
    id: num(row.id),
    name: str(row.name, "Reunión"),
    status: str(row.status),
    start_time: str(row.start_time),
    end_time: str(row.end_time),
    invitee_name: row.invitee_name ? str(row.invitee_name) : null,
    invitee_email: row.invitee_email ? str(row.invitee_email) : null,
    meeting_url: row.meeting_url ? str(row.meeting_url) : null,
  };
}

function asHistory(raw: unknown): ProspectHistoryEntry | null {
  const row = asRecord(raw);
  if (!row || !row.id) return null;
  return {
    id: num(row.id),
    event_type: str(row.event_type),
    from_status: row.from_status ? str(row.from_status) : null,
    to_status: row.to_status ? str(row.to_status) : null,
    note: row.note ? str(row.note) : null,
    changed_by_user_id: num(row.changed_by_user_id),
    changed_by_name: row.changed_by_name ? str(row.changed_by_name) : null,
    created_at: str(row.created_at),
  };
}

export function pipelineFromSourceProspect(raw: ClientSourceProspect): ClientPipeline {
  const envelopeList = Array.isArray(raw.docusign_envelopes)
    ? raw.docusign_envelopes
    : raw.docusign_envelope
      ? [raw.docusign_envelope]
      : [];
  const envelopes = envelopeList
    .map(asEnvelope)
    .filter((item): item is ProspectEnvelopeBrief => item != null);

  const paymentList = Array.isArray(raw.payment_links)
    ? raw.payment_links
    : raw.payment_link
      ? [raw.payment_link]
      : [];
  const payments = paymentList
    .map(asPayment)
    .filter((item): item is ProspectPaymentBrief => item != null);
  const payment = asPayment(raw.payment_link) ?? payments[0] ?? null;
  if (payment && !payments.some((item) => item.id === payment.id)) {
    payments.unshift(payment);
  }

  const history = (Array.isArray(raw.history) ? raw.history : [])
    .map(asHistory)
    .filter((item): item is ProspectHistoryEntry => item != null);

  return {
    prospectId: raw.prospect_id != null ? num(raw.prospect_id) : null,
    status: str(raw.status),
    isQualified: Boolean(raw.is_qualified),
    history,
    calendly: asCalendly(raw.calendly_event),
    envelopes,
    payment,
    payments,
  };
}
