"use client";

import { useId, useState } from "react";

const defaultInputs = {
  price: "79",
  visits: "2",
  payout: "25",
  members: "100",
  feePercent: "3.6",
  feeFixed: "0.30",
  reserve: "5",
  acquisition: "30",
  paidMonths: "4",
  fixedCosts: "1000",
};

type Inputs = typeof defaultInputs;
type Field = {
  key: keyof Inputs;
  label: string;
  step: number;
  min?: number;
  max?: number;
};

const fields: { title: string; inputs: Field[] }[] = [
  {
    title: "Membership and studio payout",
    inputs: [
      { key: "price", label: "Monthly price ($)", step: 0.01 },
      { key: "visits", label: "Included visits per member", step: 1 },
      { key: "payout", label: "Studio payout per visit ($)", step: 0.01 },
      { key: "members", label: "Active members", step: 1 },
    ],
  },
  {
    title: "Operating and acquisition costs",
    inputs: [
      { key: "feePercent", label: "Payment and billing fee (%)", step: 0.1, max: 100 },
      { key: "feeFixed", label: "Fixed fee per payment ($)", step: 0.01 },
      { key: "reserve", label: "Support and refunds per member ($)", step: 0.01 },
      { key: "acquisition", label: "Cost to acquire one member ($)", step: 0.01 },
      { key: "paidMonths", label: "Average paid months", step: 0.1, min: 0.1 },
      { key: "fixedCosts", label: "Monthly fixed costs ($)", step: 0.01 },
    ],
  },
];

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function isValid(raw: string, { min = 0, max, step }: Field) {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isFinite(value) && value >= min
    && (max === undefined || value <= max) && (step !== 1 || Number.isInteger(value));
}

function estimate(inputs: Inputs) {
  const price = Number(inputs.price);
  const visits = Number(inputs.visits);
  const members = Number(inputs.members);
  const fixedCosts = Number(inputs.fixedCosts);
  const paymentFee = price * Number(inputs.feePercent) / 100 + Number(inputs.feeFixed);
  const acquisitionPerMonth = Number(inputs.acquisition) / Number(inputs.paidMonths);
  const studioBudget = price - paymentFee - Number(inputs.reserve) - acquisitionPerMonth;
  const contribution = studioBudget - visits * Number(inputs.payout);
  const monthly = contribution * members - fixedCosts;
  const ratio = contribution > 0 ? fixedCosts / contribution : null;
  const breakEven = fixedCosts === 0 && contribution >= 0 ? 0
    : ratio === null ? null : Math.ceil(ratio - Math.max(1, ratio) * Number.EPSILON * 4);
  const ceilingInCents = members > 0 && visits > 0 ? (studioBudget - fixedCosts / members) / visits * 100 : null;
  const payoutCeiling = ceilingInCents === null ? null
    : Math.floor(ceilingInCents + Math.max(1, Math.abs(ceilingInCents)) * Number.EPSILON * 4) / 100;
  if (![contribution, monthly, breakEven ?? 0, payoutCeiling ?? 0].every(Number.isFinite)) return null;
  return { contribution, monthly, breakEven, payoutCeiling };
}

function money(value: number | undefined) {
  return value === undefined ? "—" : dollars.format(value);
}

export function OwnerPilotCalculator() {
  const headingId = useId();
  const [inputs, setInputs] = useState(defaultInputs);
  const invalid = fields.flatMap((group) => group.inputs).find((field) => !isValid(inputs[field.key], field));
  const result = invalid ? null : estimate(inputs);
  const ceiling = result?.payoutCeiling;
  const byMember = result?.contribution;
  const monthly = result?.monthly;
  let ceilingDetail = "Rounded down to cents";
  if (result && ceiling == null) ceilingDetail = "Requires members and visits";
  if (ceiling != null && ceiling < 0) ceilingDetail = "Costs exceed available payout budget";

  const metrics = [
    { label: "Contribution per member", value: money(byMember), detail: "Before fixed costs", loss: (byMember ?? 0) < 0 },
    { label: "Monthly result", value: money(monthly), detail: "After fixed costs", loss: (monthly ?? 0) < 0 },
    {
      label: "Break-even members",
      value: result?.breakEven == null ? "—" : whole.format(result.breakEven),
      detail: result && result.breakEven === null ? "Requires positive contribution" : "Active paid memberships",
    },
    {
      label: "Max studio payout per visit",
      value: ceiling == null || ceiling < 0 ? "—" : money(ceiling),
      detail: ceilingDetail,
    },
  ];

  return (
    <section className="panel min-w-0 space-y-5 p-4 sm:p-6" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="display text-2xl sm:text-3xl" id={headingId}>Pilot economics</h2>
          <p className="muted mt-2 max-w-prose text-sm">Estimate what each member contributes and how much you can pay a studio per visit at your planned scale.</p>
        </div>
        <button type="button" className="button button-secondary" onClick={() => setInputs(defaultInputs)}>Reset assumptions</button>
      </div>

      <dl aria-live="polite" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--sage)] p-3 sm:p-4">
            <dt className="text-sm font-semibold">{metric.label}</dt>
            <dd className={`mt-1 break-words text-xl font-semibold tabular-nums sm:text-2xl ${metric.loss ? "text-rust" : ""}`}>{metric.value}</dd>
            <dd className="muted mt-1 text-xs">{metric.detail}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        {fields.map((group) => (
          <fieldset key={group.title} className="min-w-0">
            <legend className="mb-3 text-base font-semibold">{group.title}</legend>
            <div className="grid gap-3 min-[400px]:grid-cols-2">
              {group.inputs.map((field) => (
                <label key={field.key} className="field min-w-0 self-end">
                  {field.label}
                  <input
                    type="number"
                    inputMode={field.step === 1 ? "numeric" : "decimal"}
                    min={field.min ?? 0}
                    max={field.max}
                    step={field.step}
                    value={inputs[field.key]}
                    aria-invalid={!isValid(inputs[field.key], field)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setInputs((previous) => ({ ...previous, [field.key]: value }));
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {!result && (
        <p className="text-sm text-rust" role="status">
          {invalid ? `Enter a valid value for ${invalid.label.toLowerCase()} to calculate the estimate.` : "Enter smaller values to calculate the estimate."}
        </p>
      )}
      <p className="muted text-xs leading-relaxed">Pre-tax estimate. Assumes members use every included visit. Acquisition cost is spread across their average paid months.</p>
    </section>
  );
}
