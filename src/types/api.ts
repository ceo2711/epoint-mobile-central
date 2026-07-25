export interface RoleBrief {
  id: number;
  code: string;
  name: string;
}

export interface AreaBrief {
  id: number;
  code: string;
  name: string;
}

export interface MerchantBrief {
  id: number;
  code: string;
  name: string;
}

export interface AdvisorBrief {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: RoleBrief;
  area: AreaBrief | null;
  must_change_password: boolean;
  totp_enabled: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  avatar_url?: string | null;
  permissions?: string[];
  client_id?: number | null;
  merchants?: MerchantBrief[];
  active_merchant_id?: number | null;
  active_merchant?: MerchantBrief | null;
}

export interface Merchant {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  permissions: { id: number; code: string; name: string }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface LoginResponse {
  requires_2fa?: boolean;
  temp_token?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_type: string;
  must_change_password: boolean;
  user: User | null;
}

export interface LocalizedStringList {
  en: string[];
  es: string[];
}

export interface Address {
  id: number;
  type: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  residence_since_month: number | null;
  residence_since_year: number | null;
}

export interface Vehicle {
  id: number;
  order: number;
  model: string;
  year: number;
  color: string;
}

export interface DocumentBrief {
  id: number;
  type: string;
  verification_status: string;
  original_filename: string;
  mime_type?: string | null;
  download_url?: string | null;
  expires_at: string | null;
  uploaded_at: string;
  rejection_reasons?: LocalizedStringList | null;
  approval_reasons?: LocalizedStringList | null;
}

export interface CardComment {
  id: number;
  body: string;
  is_internal: boolean;
  author_name: string;
  created_at: string;
}

export interface CardAttachment {
  id: number;
  type: string;
  original_filename: string;
  mime_type?: string | null;
  download_url: string | null;
  comment_id?: number | null;
  uploaded_by_name?: string | null;
  created_at?: string | null;
  verification_status?: string | null;
  rejection_reasons?: LocalizedStringList | null;
  approval_reasons?: LocalizedStringList | null;
}

export interface BoardCard {
  id: number;
  title: string;
  description_md: string | null;
  instructions_md: string | null;
  external_links: string | null;
  status: string;
  position: number;
  requires_credentials: boolean;
  requires_file_upload: boolean;
  client_result_text: string | null;
  comments: CardComment[];
  attachments: CardAttachment[];
  has_credentials: boolean;
}

export interface BoardList {
  id: number;
  title: string;
  position: number;
  cards: BoardCard[];
}

export interface Board {
  id: number;
  client_id: number;
  template_code: string;
  lists: BoardList[];
}

export interface ClientSignedContractBrief {
  envelope_id: number;
  signed_at: string;
  subject: string;
  has_document: boolean;
}

/** Nested pipeline summary when the client was converted from a prospect. */
export interface ClientSourceProspect {
  prospect_id?: number;
  status?: string;
  is_qualified?: boolean;
  history?: ProspectHistoryEntry[];
  calendly_event?: {
    id?: number;
    name?: string;
    status?: string;
    start_time?: string;
    end_time?: string;
    invitee_name?: string | null;
    invitee_email?: string | null;
    meeting_url?: string | null;
  } | null;
  docusign_envelope?: {
    id?: number;
    subject?: string;
    status?: string;
    sent_at?: string;
    completed_at?: string | null;
  } | null;
  docusign_envelopes?: {
    id?: number;
    subject?: string;
    status?: string;
    sent_at?: string;
    completed_at?: string | null;
  }[];
  payment_link?: {
    id?: number;
    amount?: string;
    currency?: string;
    status?: string;
    payment_url?: string;
    paid_at?: string | null;
  } | null;
  [key: string]: unknown;
}

export interface ClientPortalPassword {
  email: string;
  temp_password: string;
  portal_login_url: string;
}

export interface Client {
  id: number;
  status: string;
  is_qualified?: boolean;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string | null;
  merchant: MerchantBrief | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  approved_at: string | null;
  date_of_birth: string | null;
  has_ssn: boolean;
  registered_by_user_id: number;
  registered_by?: AdvisorBrief | null;
  created_at: string;
  docusign_contract_signed_at?: string | null;
  signed_contract?: ClientSignedContractBrief | null;
  has_portal_access?: boolean;
  portal_email?: string | null;
  portal_login_url?: string | null;
  portal_temp_password?: string | null;
  advisor?: AdvisorBrief | null;
  addresses?: Address[];
  vehicles?: Vehicle[];
  documents?: DocumentBrief[];
  source_prospect?: ClientSourceProspect | null;
}

export interface ClientConflict {
  client_id: number;
  client_name: string;
  client_email: string;
}

export interface ClientAvailability {
  available: boolean;
  email: ClientConflict | null;
  phone: ClientConflict | null;
}

export interface ClientBulkDeleteFailure {
  client_id: number;
  reason: string;
}

export interface ClientBulkDeleteResponse {
  deleted_ids: number[];
  failures: ClientBulkDeleteFailure[];
}

export interface SentEmailEntry {
  id: number;
  subject: string;
  message_html: string;
  recipient_email: string;
  sent_by_name: string;
  created_at: string;
}

export interface OnboardingReminderRunResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  dry_run: boolean;
}

export interface SalesRepBrief {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface ClientStats {
  pending_review: number;
  approved_in_onboarding: number;
  rejected: number;
  onboarding_in_progress: number;
  completed: number;
  total: number;
}

export interface AreaMetrics {
  code: string;
  name: string;
  scope: "personal" | "general";
  total: number;
  in_pipeline: number;
  completed: number;
  conversion_rate: number | null;
  by_status: { status: string; count: number }[];
}

export interface DashboardMetrics {
  merchant: MerchantBrief;
  viewer_scope: "personal" | "general";
  summary: ClientStats;
  by_status: Record<string, number>;
  areas: AreaMetrics[];
}

export type ProspectStatus =
  | "PENDIENTE_CONTACTAR"
  | "LEAD_CONTACTADO"
  | "LEAD_CERRADO"
  | "CONTRATO_ENVIADO"
  | "PAGO_COMPLETADO";

export interface Prospect {
  id: number;
  merchant_id: number;
  assigned_to_user_id: number;
  status: ProspectStatus | string;
  is_qualified: boolean;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  source: string | null;
  notes: string | null;
  converted_client_id: number | null;
  calendly_event_id: number | null;
  docusign_envelope_id: number | null;
  payment_link_id: number | null;
  created_at: string;
  updated_at: string;
  assigned_to: AdvisorBrief | null;
  merchant_name: string | null;
}

export interface ProspectHistoryEntry {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  changed_by_user_id: number;
  changed_by_name: string | null;
  created_at: string;
}

export interface ProspectDetail extends Prospect {
  history: ProspectHistoryEntry[];
  calendly_event?: {
    id: number;
    name: string;
    status: string;
    start_time: string;
    end_time: string;
    invitee_name: string | null;
    invitee_email: string | null;
    meeting_url: string | null;
  } | null;
  docusign_envelope?: {
    id: number;
    subject: string;
    status: string;
    sent_at: string;
    completed_at: string | null;
  } | null;
  payment_link?: {
    id: number;
    amount: string;
    currency: string;
    status: string;
    payment_url: string;
    paid_at: string | null;
  } | null;
}

export interface CalendlyConnection {
  connected: boolean;
  user_id: number | null;
  calendly_user_name: string | null;
  scheduling_url: string | null;
  last_synced_at: string | null;
}

export interface CalendlyEvent {
  id: number;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  event_type_name: string | null;
  invitee_name: string | null;
  invitee_email: string | null;
  location: string | null;
  meeting_url: string | null;
  prospect_id: number | null;
}

export interface CalendlySyncResponse {
  synced_count: number;
  last_synced_at: string;
}

export interface DocusignConnection {
  connected: boolean;
  account_id: string | null;
  default_template_id: string | null;
}

export interface DocusignEnvelope {
  id: number;
  docusign_envelope_id: string;
  signer_name: string;
  signer_email: string;
  subject: string;
  status: string;
  client_id: number | null;
  client_name: string | null;
  prospect_id: number | null;
  sent_at: string;
  completed_at: string | null;
}

export interface PaymentConfig {
  payments_enabled: boolean;
  default_provider: string;
  stub_mode: boolean;
  providers: { provider: string; configured: boolean; label: string }[];
}

export interface PaymentLink {
  id: number;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  amount: string;
  currency: string;
  provider: string;
  status: string;
  description: string | null;
  payment_url: string;
  external_checkout_url: string | null;
  paid_at: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface Notification {
  id: number;
  event_type: string;
  channel: string;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
  status?: string;
  read_at: string | null;
  created_at: string;
}

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  PENDIENTE_DE_REVISION: "Pendiente de revisión",
  RECHAZADO: "Rechazado",
  APROBADO_PARA_ONBOARDING: "Aprobado",
  EN_CARGA_DATOS: "En carga de datos",
  DOCUMENTOS_EN_REVISION: "Documentos en revisión",
  LISTO_PARA_TRABAJAR: "Listo para trabajar",
  ONBOARDING_EN_PROGRESO: "Onboarding en progreso",
  ONBOARDING_COMPLETADO: "Completado",
  INACTIVO: "Inactivo",
};

export const PROSPECT_STATUS_LABELS: Record<string, string> = {
  PENDIENTE_CONTACTAR: "Pendiente por contactar",
  LEAD_CONTACTADO: "Lead contactado",
  LEAD_CERRADO: "Lead cerrado",
  CONTRATO_ENVIADO: "Contrato enviado",
  PAGO_COMPLETADO: "Pago completado",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  SSN_CARD: "Tarjeta SSN",
  DRIVERS_LICENSE_FRONT: "Licencia (frente)",
  DRIVERS_LICENSE_BACK: "Licencia (dorso)",
  UTILITY_BILL: "Utility Bill",
  BANK_STATEMENT: "Bank Statement",
  PASSPORT: "Pasaporte",
  GREEN_CARD: "Green Card",
  WORK_PERMIT: "Permiso de trabajo",
};

export const DOCUMENT_TYPES = [
  { value: "SSN_CARD", label: "Tarjeta SSN" },
  { value: "DRIVERS_LICENSE_FRONT", label: "Licencia (frente)" },
  { value: "DRIVERS_LICENSE_BACK", label: "Licencia (dorso)" },
  { value: "UTILITY_BILL", label: "Utility Bill" },
  { value: "BANK_STATEMENT", label: "Bank Statement" },
  { value: "PASSPORT", label: "Pasaporte" },
  { value: "GREEN_CARD", label: "Green Card" },
  { value: "WORK_PERMIT", label: "Permiso de trabajo" },
] as const;

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  COMPLETADA: "Completada",
};

export const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  PROXIMO_A_VENCER: "Próximo a vencer",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  expired: "Expirado",
  cancelled: "Cancelado",
};
