import { useState, type FormEvent } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { SITE_CONFIG } from "@/config/siteConfig";
import { askForHelp, type HelpTopic } from "@/lib/firebase/help";

const copy = DASHBOARD_CONFIG.help;
const TOPICS = Object.keys(copy.topics) as HelpTopic[];

/**
 * "Need help?" at the foot of the parent and teacher pages. Sends a short request to the team, who get an
 * email and a push straight away. WhatsApp stays as the fallback. In a preview nothing is sent.
 */
export function HelpBox({
  practice,
  intro,
  whatsappText,
  startOpen = false,
}: {
  practice: boolean;
  intro?: string;
  whatsappText: string;
  /** The Help screen shows the form straight away. */
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [topic, setTopic] = useState<HelpTopic>("class");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const whatsapp = `https://wa.me/${SITE_CONFIG.contact.whatsapp}?text=${encodeURIComponent(whatsappText)}`;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (practice) return setState("sent");
    setState("sending");
    setError(null);
    try {
      await askForHelp(topic, message.trim());
      setState("sent");
    } catch (err) {
      const text = (err as { message?: string }).message;
      setError(text && !/internal|network/i.test(text) ? text : copy.failed);
      setState("failed");
    }
  };

  if (state === "sent")
    return (
      <p className="pd-help pd-help-sent" role="status">
        {practice ? copy.practice : copy.sent}
      </p>
    );

  if (!open)
    return (
      <p className="pd-help">
        {intro && `${intro} `}
        <button type="button" className="pd-link" onClick={() => setOpen(true)}>
          {copy.open}
        </button>
      </p>
    );

  return (
    <form className="pd-card pd-stack pd-help-form" onSubmit={(e) => void send(e)}>
      <h2>{copy.title}</h2>
      <fieldset className="pd-lc-repeat">
        <legend>{copy.topicLabel}</legend>
        <div className="pd-picker" role="group">
          {TOPICS.map((t) => (
            <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(t)}>
              {copy.topics[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="pd-field">
        {copy.messageLabel}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={copy.placeholder}
          rows={3}
          maxLength={600}
          required
          minLength={3}
        />
      </label>
      {error && (
        <p className="pd-alert" role="alert">
          {error}
        </p>
      )}
      <div className="pd-lc-actions">
        <button type="submit" className="pd-cta pd-lc-btn" disabled={state === "sending" || message.trim().length < 3}>
          {state === "sending" ? copy.sending : copy.send}
        </button>
        {!startOpen && (
          <button type="button" className="pd-ghost" onClick={() => setOpen(false)}>
            {copy.back}
          </button>
        )}
      </div>
      <a className="pd-help-wa" href={whatsapp} target="_blank" rel="noopener noreferrer">
        {copy.whatsapp}
      </a>
    </form>
  );
}
