import { getCurrentUser } from "@/lib/auth";
import { getOwnerMetrics } from "@/lib/owner-metrics";
import { readOwnerPeriod } from "@/lib/owner-period";

export const dynamic = "force-dynamic";

function csvField(value: string | number) {
  if (typeof value === "number") return String(value);
  const safeText = /^\s*[=+\-@]|^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safeText.replaceAll('"', '""') + '"';
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return Response.json({ error: "Owner access required" }, {
      status: user ? 403 : 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const values = new URL(request.url).searchParams.getAll("days");
  const days = readOwnerPeriod(values.length === 1 ? values[0] : undefined);
  const { studios, trend } = await getOwnerMetrics(days);
  const start = trend[0]?.day ?? "";
  const end = trend[trend.length - 1]?.day ?? "";
  const rows = [
    ["Period start (New York)", "Period end (New York)", "Studio", "Neighborhood", "Attended visits", "Calculated payout (USD)",
      "Upcoming sessions", "Upcoming quota", "Upcoming bookings", "Check-ins due"],
    ...studios.map((studio) => [start, end, studio.name, studio.neighborhood, studio.attended, (studio.payoutCents / 100).toFixed(2),
      studio.upcomingSessions, studio.upcomingQuota, studio.upcomingBooked, studio.pendingCheckins]),
  ];
  const body = "\uFEFF" + rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";

  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="avopore-studios-' + days + '-days.csv"',
    },
  });
}
