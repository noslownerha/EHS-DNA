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

// Brand palette (matches the app's forest/sage).
// Brand palette for email. Mirrors src/constants.js BRAND_COLORS (email runs
// outside the JS bundle so it can't import that file — keep in sync on rebrand).
const BRAND = { forest: "#1C3A2A", sage: "#4A8C5C", ink: "#0F1F17", mist: "#6B7E76", chalk: "#F4F7F5", line: "#E2EBE6" };
const APP_URL = process.env.EHS_APP_URL || "https://app.ehsdna.com";

const escapeHtml = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Render a branded HTML alert. Deliberately table-based with inline styles —
 * that is what survives Gmail, Outlook, and Apple Mail intact. `meta` is the
 * one-line "Site · severity · by reporter" summary; `link` deep-links to the
 * record so a manager can act without hunting for it.
 */
function renderAlertHtml({ heading, meta, link, linkLabel, company }) {
  const button = link ? `
    <tr><td style="padding:24px 32px 8px;">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:${BRAND.sage};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;font-family:'Helvetica Neue',Arial,sans-serif;">${escapeHtml(linkLabel || "View in EHS DNA")}</a>
    </td></tr>` : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.chalk};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.chalk};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.line};">
        <tr><td style="background:${BRAND.forest};padding:18px 32px;">
          <span style="color:#ffffff;font-weight:700;font-size:16px;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:.3px;">EHS&nbsp;<span style="color:${BRAND.sage};">DNA</span></span>${company ? `<span style="color:${BRAND.mist};font-size:13px;font-family:'Helvetica Neue',Arial,sans-serif;"> &nbsp;·&nbsp; ${escapeHtml(company)}</span>` : ""}
        </td></tr>
        <tr><td style="padding:28px 32px 4px;">
          <h1 style="margin:0;font-size:19px;line-height:1.35;color:${BRAND.ink};font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;">${escapeHtml(heading)}</h1>
        </td></tr>
        ${meta ? `<tr><td style="padding:8px 32px 0;">
          <p style="margin:0;font-size:14px;color:${BRAND.mist};font-family:'Helvetica Neue',Arial,sans-serif;">${escapeHtml(meta)}</p>
        </td></tr>` : ""}
        ${button}
        <tr><td style="padding:24px 32px 28px;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.mist};font-family:'Helvetica Neue',Arial,sans-serif;">
            You're receiving this because you're on the notification list for this event in EHS DNA.
            ${link ? `If the button doesn't work, open:<br><a href="${escapeHtml(link)}" style="color:${BRAND.sage};">${escapeHtml(link)}</a>` : ""}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

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

/**
 * Send a branded alert email built from a notification's parts. This is what
 * notify() uses, so every incident/finding alert gets the same clean layout and
 * a deep link straight to the record instead of a bare one-liner.
 */
async function sendAlert(to, { title, meta, linkKind, linkRef, company }) {
  // Deep link to the specific record when we know how to address it.
  const link = linkKind && linkRef
    ? `${APP_URL}/?open=${encodeURIComponent(linkKind)}:${encodeURIComponent(linkRef)}`
    : APP_URL;
  const linkLabel = linkKind === "incident" ? "View incident"
    : linkKind === "finding" ? "View finding"
    : "Open EHS DNA";

  const html = renderAlertHtml({ heading: title, meta, link, linkLabel, company });
  // Plain-text fallback for clients that don't render HTML — still useful.
  const text = [title, meta, "", `${linkLabel}: ${link}`].filter(Boolean).join("\n");

  return sendEmail(to, title, text, html);
}

module.exports = { sendEmail, sendAlert, emailConfigured };
