import type { OwnerPeriod } from "@/lib/owner-metrics";

export const ownerPeriods = [7, 30, 90] as const;

export function readOwnerPeriod(value: string | string[] | null | undefined): OwnerPeriod {
  return ownerPeriods.find((period) => String(period) === value) ?? 30;
}
