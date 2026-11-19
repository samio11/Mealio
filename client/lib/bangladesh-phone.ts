const BD_PHONE_INPUT = /^(?:\+?880|00880|0)1[3-9]\d{8}$/;
const BD_PHONE_INTERNATIONAL = /^\+8801[3-9]\d{8}$/;

export function isBangladeshPhone(value: string): boolean {
  return BD_PHONE_INPUT.test(value.replace(/[\s-]/g, ""));
}

export function normalizeBangladeshPhone(value: string): string {
  const compact = value.replace(/[\s-]/g, "");
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `+88${compact}`;
  if (compact.startsWith("880")) return `+${compact}`;
  return compact;
}

export function bangladeshWhatsAppNumber(value: string | null): string | null {
  if (!value) return null;
  const normalized = normalizeBangladeshPhone(value);
  return BD_PHONE_INTERNATIONAL.test(normalized) ? normalized.slice(1) : null;
}
