import { useState } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, COLORS } from "./constants.js";

// ── Design tokens ────────────────────────────────────────────────────────────
const C = { ...COLORS };

const INDUSTRIES = [
  "Food & Beverage",
  "Spirits / Distilling",
  "Craft Brewing",
  "Light Manufacturing",
  "Warehousing / Logistics",
  "Chemical Processing",
  "Construction",
  "Healthcare / Life Sciences",
  "Mining & Extraction",
  "Other",
];

const SITE_COUNTS = ["1", "2–3", "4–6", "7–10", "10+"];

// ── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = ["Company", "Sites", "Departments", "Staff", "Training"];

function Stepper({ current }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      overflowX: "auto", paddingBottom: 4, marginBottom: 32,
      scrollbarWidth: "none",
    }}>
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {/* Dot */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".8rem", fontWeight: 700, flexShrink: 0,
              background: state === "done" ? C.sage : state === "active" ? C.forest : "#E2EBE6",
              color: state === "pending" ? C.mist : C.white,
              boxShadow: state === "active" ? `0 0 0 4px ${C.mint}` : "none",
              transition: "all .2s",
            }}>
              {state === "done" ? "✓" : i + 1}
            </div>
            {/* Label */}
            <span style={{
              fontSize: ".75rem", fontWeight: state === "active" ? 700 : 500,
              color: state === "done" ? C.sage : state === "active" ? C.forest : C.slate,
              marginLeft: 8, marginRight: 4, whiteSpace: "nowrap",
            }}>
              {label}
            </span>
            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 20, maxWidth: 48,
                background: state === "done" ? C.sage : "#D0DEDB",
                margin: "0 4px", transition: "background .3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared field components ──────────────────────────────────────────────────
function Label({ children }) {
  return (
    <div style={{
      fontSize: ".72rem", fontWeight: 600,
      letterSpacing: ".07em", textTransform: "uppercase",
      color: C.sage, marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function FieldGroup({ children, style = {} }) {
  return <div style={{ marginBottom: 18, ...style }}>{children}</div>;
}

function TextInput({ type = "text", value, onChange, placeholder, hasError }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "10px 14px",
        border: `1.5px solid ${hasError ? C.red : focused ? C.sage : "#D0DEDB"}`,
        borderRadius: 7,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: ".9rem", color: C.ink,
        background: C.white, outline: "none",
        boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : hasError ? `0 0 0 3px rgba(192,57,43,.1)` : "none",
        transition: "all .18s cubic-bezier(.4,0,.2,1)",
      }}
    />
  );
}

function SelectInput({ value, onChange, options, hasError }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "10px 14px",
        border: `1.5px solid ${hasError ? C.red : focused ? C.sage : "#D0DEDB"}`,
        borderRadius: 7,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: ".9rem", color: C.ink,
        background: C.white, outline: "none",
        boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
        transition: "all .18s cubic-bezier(.4,0,.2,1)",
        cursor: "pointer", appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238FA3A0'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 14px center",
        paddingRight: 36,
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#E8EFec", margin: "20px 0" }} />;
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: ".82rem", fontWeight: 600, color: C.slate,
      marginBottom: 12, textTransform: "uppercase", letterSpacing: ".05em",
    }}>
      {children}
    </div>
  );
}

function InlineError({ msg }) {
  return msg ? (
    <div style={{ fontSize: ".75rem", color: C.red, marginTop: 4 }}>⚠ {msg}</div>
  ) : null;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function S1b1CompanyInfo({ initialData = {}, onContinue, onBack, onHome }) {
  const [companyName, setCompanyName] = useState(initialData.companyName ?? BRAND.company);
  const [industry,    setIndustry]    = useState(initialData.industry    ?? "Spirits / Distilling");
  const [siteCount,   setSiteCount]   = useState(initialData.siteCount   ?? "4–6");
  const [contactName, setContactName] = useState(initialData.contactName ?? "Ahren Hartman");
  const [billingEmail,setBillingEmail]= useState(initialData.billingEmail ?? "ahren@whistlepigwhiskey.com");
  const [apEmail,     setApEmail]     = useState(initialData.apEmail     ?? "");
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(false);

  function validate() {
    const e = {};
    if (!companyName.trim()) e.companyName = "Company name is required.";
    if (!contactName.trim()) e.contactName = "Contact name is required.";
    if (!billingEmail.trim()) e.billingEmail = "Billing email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail))
      e.billingEmail = "Enter a valid email address.";
    if (apEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(apEmail))
      e.apEmail = "Enter a valid email address.";
    return e;
  }

  function handleContinue() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (onContinue) onContinue({ companyName, industry, siteCount, contactName, billingEmail, apEmail });
    }, 600);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: C.chalk,
      fontFamily: "'DM Sans', sans-serif",
      paddingBottom: 80,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder, textarea::placeholder { color: ${C.mist}; }
        select option { color: ${C.ink}; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .anim { animation: fadeUp .28s cubic-bezier(.4,0,.2,1) both; }
        .btn-primary-hover:hover:not(:disabled) {
          background: ${C.pine} !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(45,90,61,.3);
        }
        .btn-secondary-hover:hover {
          background: ${C.foam} !important;
        }
        .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 520px) { .input-row { grid-template-columns: 1fr; } }
      `}</style>

      {/* ── Top nav bar ── */}
      <EHSHeader onHome={onHome} rightContent={
        <div style={{ fontSize: ".72rem", color: C.mist, background: "rgba(255,255,255,.08)", padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
          New account setup
        </div>
      } />

      {/* ── Page content ── */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px 80px" }}>

        <div className="anim" style={{ animationDelay: "0ms" }}>
          <Stepper current={0} />
        </div>

        <div className="anim" style={{ marginBottom: 24, animationDelay: "40ms" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: C.ink }}>
            Tell us about your company
          </h1>
          <p style={{ fontSize: ".9rem", color: C.slate, marginTop: 4, lineHeight: 1.5 }}>
            Takes about 2 minutes. You can edit everything later.
          </p>
        </div>

        {/* ── Main form card ── */}
        <div
          className="anim"
          style={{
            background: C.white,
            borderRadius: 10,
            boxShadow: "0 2px 16px rgba(15,31,23,.08)",
            padding: 28,
            animationDelay: "80ms",
          }}
        >
          {/* Company name */}
          <FieldGroup>
            <Label>Company name</Label>
            <TextInput
              value={companyName}
              onChange={e => { setCompanyName(e.target.value); setErrors(er => ({ ...er, companyName: "" })); }}
              placeholder="Your company name"
              hasError={!!errors.companyName}
            />
            <InlineError msg={errors.companyName} />
          </FieldGroup>

          {/* Industry + Site count */}
          <div className="input-row" style={{ marginBottom: 18 }}>
            <div>
              <Label>Industry</Label>
              <SelectInput
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                options={INDUSTRIES}
              />
              <div style={{ fontSize: ".73rem", color: C.mist, marginTop: 5 }}>
                Pre-fills department suggestions on next step
              </div>
            </div>
            <div>
              <Label>Number of sites</Label>
              <SelectInput
                value={siteCount}
                onChange={e => setSiteCount(e.target.value)}
                options={SITE_COUNTS}
              />
            </div>
          </div>

          <Divider />

          <SectionLabel>Billing Contact</SectionLabel>

          {/* Contact name + Billing email */}
          <div className="input-row" style={{ marginBottom: 18 }}>
            <div>
              <Label>Contact name</Label>
              <TextInput
                value={contactName}
                onChange={e => { setContactName(e.target.value); setErrors(er => ({ ...er, contactName: "" })); }}
                placeholder="Full name"
                hasError={!!errors.contactName}
              />
              <InlineError msg={errors.contactName} />
            </div>
            <div>
              <Label>Billing email</Label>
              <TextInput
                type="email"
                value={billingEmail}
                onChange={e => { setBillingEmail(e.target.value); setErrors(er => ({ ...er, billingEmail: "" })); }}
                placeholder="you@yourcompany.com"
                hasError={!!errors.billingEmail}
              />
              <InlineError msg={errors.billingEmail} />
            </div>
          </div>

          {/* AP email */}
          <FieldGroup>
            <Label>
              Accounts payable email{" "}
              <span style={{ fontWeight: 400, color: C.mist, textTransform: "none", letterSpacing: 0 }}>
                (for invoices)
              </span>
            </Label>
            <TextInput
              type="email"
              value={apEmail}
              onChange={e => { setApEmail(e.target.value); setErrors(er => ({ ...er, apEmail: "" })); }}
              placeholder="ap@yourcompany.com"
              hasError={!!errors.apEmail}
            />
            <InlineError msg={errors.apEmail} />
          </FieldGroup>
        </div>

        {/* ── Industry hint card ── */}
        {(industry === "Spirits / Distilling" || industry === "Craft Brewing") && (
          <div
            className="anim"
            style={{
              marginTop: 12,
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "14px 16px",
              background: C.foam,
              borderLeft: `3px solid ${C.sage}`,
              borderRadius: 8,
              fontSize: ".87rem",
              color: C.pine,
              lineHeight: 1.5,
              animationDelay: "0ms",
            }}
          >
            <span style={{ marginTop: 1 }}>🌿</span>
            <span>
              <strong>{industry}</strong> selected — we'll suggest distillery department templates
              (Bottling, Warehouse, Barrel House, Production, Facility Maintenance) on the next step.
            </span>
          </div>
        )}

        {/* ── Annotation ── */}
        <div
          className="anim"
          style={{
            marginTop: 12,
            position: "relative",
            padding: "10px 14px 10px 36px",
            background: "#FFF8E7",
            border: "1px dashed #E8C87A",
            borderRadius: 7,
            fontSize: ".78rem", color: "#7A5A1A",
            lineHeight: 1.5,
            animationDelay: "120ms",
          }}
        >
          <span style={{ position: "absolute", left: 10, top: 10, fontSize: ".85rem" }}>✏️</span>
          UX NOTE: Only 5 fields visible. AP email is the only one that might require thought.
          Industry selection pre-configures suggested department templates on the next screen.
        </div>
      </div>

      {/* ── Fixed action bar ── */}
      <div style={{
        position: "fixed", bottom: 58, left: 0, right: 0,
        background: C.white,
        borderTop: "1px solid #E2EBE6",
        padding: "14px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 50,
        boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
      }}>
        <span style={{ fontSize: ".8rem", color: C.mist }}>Step 1 of 5</span>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {onBack && (
            <button
              className="btn-secondary-hover"
              onClick={onBack}
              style={{
                padding: "10px 18px",
                background: C.white, color: C.pine,
                border: `1.5px solid ${C.mint}`,
                borderRadius: 7,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: ".88rem", fontWeight: 600,
                cursor: "pointer", transition: "all .18s",
              }}
            >
              ← Back
            </button>
          )}
          <button
            className="btn-primary-hover"
            onClick={handleContinue}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px",
              background: loading ? C.sage + "99" : C.sage,
              color: C.white,
              border: "none", borderRadius: 7,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: ".88rem", fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              transition: "all .18s cubic-bezier(.4,0,.2,1)",
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 14, height: 14,
                  border: `2px solid rgba(255,255,255,.4)`,
                  borderTopColor: C.white,
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin .7s linear infinite",
                }} />
                Saving…
              </>
            ) : "Continue to Sites →"}
          </button>
        </div>
      </div>
    </div>
  );
}
