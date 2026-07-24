export const CLIENTS_PAGE_SIZE = 10;

export const CLIENT_SOURCE_VALUES = [
  "WEB_PAGE",
  "WHATSAPP",
  "FACEBOOK",
  "INSTAGRAM",
  "REFERRAL",
  "PHONE_CALL",
  "INFLUENCERS",
  "OTHER",
] as const;

export type ClientSourceValue = (typeof CLIENT_SOURCE_VALUES)[number];

export const CLIENT_SOURCE_LABELS: Record<ClientSourceValue, string> = {
  WEB_PAGE: "Página web",
  WHATSAPP: "WhatsApp",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  REFERRAL: "Referido",
  PHONE_CALL: "Llamada",
  INFLUENCERS: "Influencers",
  OTHER: "Otro",
};

export const DOCUMENT_UPLOAD_SLOTS = [
  { value: "SSN_CARD", label: "Tarjeta SSN" },
  { value: "DRIVERS_LICENSE_FRONT", label: "Licencia (frente)" },
  { value: "DRIVERS_LICENSE_BACK", label: "Licencia (dorso)" },
  { value: "PASSPORT", label: "Pasaporte" },
  { value: "GREEN_CARD", label: "Green Card" },
  { value: "WORK_PERMIT", label: "Permiso de trabajo" },
  { value: "UTILITY_BILL", label: "Utility Bill" },
  { value: "BANK_STATEMENT", label: "Bank Statement" },
] as const;
