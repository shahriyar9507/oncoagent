"use client";

import { useEffect, useRef, useState } from "react";
import type { DecisionAction, RecommendationCard } from "@/lib/types";
import { appendAudit } from "@/lib/audit";
import { useSessionUser } from "@/lib/remote";
import { IconCheck, IconEdit, IconX } from "./icons";

export const REASONS = ["Patient preference or circumstances", "Clinical judgement", "Information missing or wrong", "Evidence outdated", "Drug not available or not affordable", "Other"];

export function toast(message: string, tone: "mint" | "red" | "amber" = "mint") {
  window.dispatchEvent(new CustomEvent("oncoagent-toast", { detail: { message, tone } }));
}

/** Approve / modify / reject with a reason; writes one hash-chained entry. */
export function DecisionDialog({ card, action, patientId, patientName, onClose }: { card: RecommendationCard; action: DecisionAction; patientId: string; patientName?: string; onClose: () => void }) {
  const [reasonCode, setReasonCode] = useState(action === "approve" ? "" : REASONS[0]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const me = useSessionUser();
  const overridesFlag = action === "approve" && card.critic.verdict === "flag";
  const [ack, setAck] = useState(false);
  const needsReason = action !== "approve" || overridesFlag;
  const firstRef = useRef<HTMLSelectElement | HTMLTextAreaElement | null>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (overridesFlag && !ack) {
      setErr("Confirm that you reviewed the safety-critic flag.");
      return;
    }
    if (needsReason && text.trim().length < 5) {
      setErr(action === "modify" ? "Describe the change (at least 5 characters)." : "Give the reason (at least 5 characters).");
      return;
    }
    setSaving(true);
    try {
      const entry = await appendAudit({ actor: me?.name ?? "Clinician", action, patientId, cardId: card.id, reasonCode: overridesFlag ? "Approved despite safety-critic flag" : action !== "approve" ? reasonCode : undefined, reasonText: text.trim() || undefined });
      const verb = action === "approve" ? "Approved" : action === "modify" ? "Modified" : "Rejected";
      toast(`${verb} and signed · audit entry #${entry.seq}`, action === "reject" ? "red" : "mint");
      onClose();
    } catch (err) {
      setErr((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const title = action === "approve" ? "Approve this card" : action === "modify" ? "Modify this card" : "Reject this card";
  const Icon = action === "approve" ? IconCheck : action === "modify" ? IconEdit : IconX;
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 id="dlg-title" className="row" style={{ gap: 10 }}><span className={`dlg-ico ${action}`}><Icon /></span>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dlg-card">
          <span className="eyebrow">{patientName ? `${patientName} · ` : ""}{card.kind} · {card.origin === "claude" ? "Claude" : card.agent}</span>
          <p>{card.proposal}</p>
        </div>
        {overridesFlag && (
          <div className="critic flag" role="alert">
            <b>Safety-critic flag:</b> {card.critic.notes.join(" ")}
            <label className="ack"><input type="checkbox" checked={ack} onChange={(e) => { setAck(e.target.checked); setErr(null); }} /> I have reviewed this flag and take responsibility for approving the card.</label>
          </div>
        )}
        {action !== "approve" && (
          <label className="field" htmlFor="dlg-reason">Reason (required)
            <select id="dlg-reason" ref={(el) => { firstRef.current = el; }} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        )}
        <label className="field" htmlFor="dlg-text">{action === "modify" ? "What you changed (required)" : action === "reject" ? "Why (required)" : overridesFlag ? "Why the flag does not apply (required)" : "Note for the record (optional)"}
          <textarea
            id="dlg-text"
            ref={(el) => { if (action === "approve") firstRef.current = el; }}
            value={text}
            onChange={(e) => { setText(e.target.value); setErr(null); }}
            placeholder={action === "modify" ? "e.g. Re-biopsy first; discuss at Friday tumour board" : action === "reject" ? "e.g. Patient declined infusion therapy" : "e.g. Agree; discussed with the patient"}
            aria-invalid={!!err}
            aria-describedby={err ? "dlg-err" : undefined}
          />
          {err && <span id="dlg-err" className="err" role="alert">{err}</span>}
        </label>
        <p className="footer-note">Signed as {me?.name ?? "the signed-in clinician"}. The entry is SHA-256 hash-chained to the previous one and cannot be edited afterwards.</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn ${action === "reject" ? "danger" : "primary"}`} disabled={saving}>{saving ? "Signing…" : action === "approve" ? "Approve and sign" : action === "modify" ? "Save and sign" : "Reject and sign"}</button>
        </div>
      </form>
    </div>
  );
}

/** Small status messages after a signed decision. Mounted once in the shell. */
export function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string; tone: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ message: string; tone: string }>).detail;
      const id = ++n;
      setItems((s) => [...s.slice(-2), { id, ...d }]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3800);
    };
    window.addEventListener("oncoagent-toast", on);
    return () => window.removeEventListener("oncoagent-toast", on);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}><span className={`dot${t.tone === "red" ? " red" : t.tone === "amber" ? " amber" : ""}`} />{t.message}</div>
      ))}
    </div>
  );
}
