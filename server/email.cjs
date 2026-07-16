/**
 * Outbound email.
 *
 * The app sends transactional alerts (an injury was reported, a corrective action
 * is overdue, a password was reset). Delivery matters — these can't sit in a spam
 * folder — so we go straight to a transactional provider (Resend) rather than
 * through a personal mailbox.
 *
 * Provider selection, in priority order:
 *   1. EHS_EMAIL_WEBHOOK  — if set, POST the raw {to,subject,text} to it. This is
 *      the escape hatch for putting n8n (or anything) in the middle later, WITHOUT
 *      touching the app. Set this and the app stops calling Resend directly.
 *   2. RESEND_API_KEY     — call the Resend HTTP API directly. This is the default.
 *   3. neither set        — log and no-op. In-app notifications still work; only
 *      the email copy is skipped. The app must never crash because email is
 *      unconfigured (e.g. in dev, or before the key is added on a new box).
 *
 * Everything here is best-effort and never throws into the caller: a failed email
 * must not roll back an incident that was already saved.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// "EHS DNA Safety <alerts@ehsdna.com>" — overridable, but this is the sane default
// once ehsdna.com is verified in Resend.
function fromAddress() {
  return process.env.EHS_EMAIL_FROM || "EHS DNA <alerts@ehsdna.com>";
}

/**
 * Send one message to one or more recipients. Returns a small result object for
 * logging/tests; never throws.
 * @param {string[]} to        recipient email addresses
 * @param {string}   subject
 * @param {string}   text      plain-text body
 * @param {string}  [html]     optional HTML body
 */
async function sendEmail(to, subject, text, html) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return { sent: false, reason: "no recipients" };

  // 1. Webhook middleware (n8n etc.) takes precedence when configured.
  if (process.env.EHS_EMAIL_WEBHOOK) {
    try {
      const r = await fetch(process.env.EHS_EMAIL_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipients, subject, text }),
      });
      if (!r.ok) throw new Error(`webhook HTTP ${r.status}`);
      return { sent: true, via: "webhook" };
    } catch (err) {
      console.error("Email webhook failed:", err.message);
      return { sent: false, via: "webhook", error: err.message };
    }
  }

  // 2. Resend HTTP API (the default path).
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: recipients,
          subject,
          text,
          ...(html ? { html } : {}),
        }),
      });
      if (!r.ok) {
        // Surface Resend's own error text — it's specific (bad key, unverified
        // domain, etc.) and worth seeing in the logs.
        const detail = await r.text().catch(() => "");
        throw new Error(`Resend HTTP ${r.status}: ${detail.slice(0, 300)}`);
      }
      return { sent: true, via: "resend" };
    } catch (err) {
      console.error("Resend send failed:", err.message);
      return { sent: false, via: "resend", error: err.message };
    }
  }

  // 3. Nothing configured — skip quietly (in-app notifications still delivered).
  console.warn("Email not configured (set RESEND_API_KEY or EHS_EMAIL_WEBHOOK) — skipping email for:", subject);
  return { sent: false, reason: "not configured" };
}

/** True if some email transport is configured — lets callers report honestly. */
function emailConfigured() {
  return !!(process.env.EHS_EMAIL_WEBHOOK || process.env.RESEND_API_KEY);
}

module.exports = { sendEmail, emailConfigured };
