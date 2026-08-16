import type { PaymentConfig } from "@/types/api";

export const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  authorize: "Authorize.net",
  paypal: "PayPal",
  stripe: "Stripe",
};

export function getConfiguredProviders(config: PaymentConfig | null | undefined): string[] {
  if (!config) return ["authorize", "paypal"];
  const active = config.providers
    .filter((provider) => provider.provider !== "stripe")
    .map((provider) => provider.provider);
  return active.length > 0 ? active : ["authorize", "paypal"];
}

export function getDefaultProvider(config: PaymentConfig | null | undefined): string {
  const configured = getConfiguredProviders(config);
  const preferred = config?.default_provider;
  if (preferred && preferred !== "stripe" && configured.includes(preferred)) {
    return preferred;
  }
  const ready = config?.providers.find(
    (provider) => provider.configured && provider.provider !== "stripe",
  );
  return ready?.provider ?? configured[0] ?? "authorize";
}

export function getProviderLabel(provider: string): string {
  return PAYMENT_PROVIDER_LABELS[provider] ?? provider;
}
