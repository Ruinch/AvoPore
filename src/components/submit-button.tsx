"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText = "Please wait…", secondary = false }: {
  children: React.ReactNode; pendingText?: string; secondary?: boolean;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`button ${secondary ? "button-secondary" : "button-primary"}`}>{pending ? pendingText : children}</button>;
}
