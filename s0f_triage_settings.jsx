import { useState } from "react";
import { EHSHeader } from "./AppShell.jsx";
import { BRAND, SITES } from "./constants.js";

const C = {
  forest: "#1C3A2A", pine: "#2D5A3D", sage: "#4A8C5C",
  mint: "#A8D5B5", foam: "#E8F5EC", ink: "#0F1F17",
  slate: "#4A5568", mist: "#8FA3A0", chalk: "#F4F7F5",
  white: "#FFFFFF", gold: "#C8922A", goldLt: "#FDF3E3",
  red: "#C0392B", redLt: "#FDECEA",
};

const CONFIGURABLE_ROLES = [
  { id: "dept_lead",  label: "Department Lead" },
  { id: "erc",        label: "Emergency Response Coordinator (ERC)" },
  { id: "safety",     label: "Safety Officer / Inspector" },
  { id: "all",        label: "All Staff" },
];

const OUTCOMES = ["Call 911", "Call triage line", "Administer first aid", "Secure the area"];

const SEED_SITES = [
  {
    id: 1, name: "Moriah",       location: "Mineville, NY",
    accessRoles: ["all"],  // stored as JSON array per spec
    expanded: true,
  },
  {
    id: 2, name: "Middlebury",   location: "Middlebury, VT",
    accessRoles: ["dept_lead", "erc"],
    expanded: false,
  },
  {
    id: 3, name: "Shoreham",     location: "Shoreham, VT",
    accessRoles: ["all"],
    expanded: false,
  },
  {
    id: 4, name: "Brandenburg",  location: "Brandenburg, KY",
    accessRoles: ["safety", "erc"],
    expanded: false,
  },
];

const SEED_QUESTIONS = [
  { id: 1, text: "Is anyone injured?" },
  { id: 2, text: "Are they conscious and breathing normally?" },
  { id: 3, text: "Can they walk and talk normally?" },
  { id: 4, text: "Are you unsure whether basic first aid is enough?" },
  { id: 5, text: "Is there property damage, a spill, or a release?" },
];

// ââ Shared primitives ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 24, flexShrink: 0,
        background: checked ? C.sage : "#D0DEDB",
        cursor: "pointer", position: "relative",
        transition: "background .2s",
      }}
    >
      <div style={{
        position: "absolute", width: 18, height: 18, borderRadius: "50%",
        background: C.white, top: 3,
        left: checked ? 21 : 3,
        transition: "left .18s cubic-bezier(.4,0,.2,1)",
        boxShadow: "0 1px 4px rgba(0,0,0,.2)",
      }} />
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: ".7rem", fontWeight: 600, letterSpacing: ".07em",
      textTransform: "uppercase", color: C.sage, marginBottom: 6,
    }}>{children}</div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{
      background: C.white, borderRadius: 10,
      boxShadow: "0 2px 16px rgba(15,31,23,.08)",
      padding: 22, marginBottom: 14,
    }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: C.ink }}>{title}</h2>
        {subtitle && <p style={{ fontSize: ".78rem", color: C.mist, marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ââ Access role summary pill ââââââââââââââââââââââââââââââââââââââââââââââââââ
function AccessSummaryPill({ roles }) {
  const hasAll = roles.includes("all");
  const label  = hasAll
    ? "All Staff"
    : roles.map(r => CONFIGURABLE_ROLES.find(x => x.id === r)?.label.split(" ")[0]).join(" + ") || "None";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 20,
      fontSize: ".72rem", fontWeight: 600,
      background: C.foam, color: C.pine,
    }}>{label}</span>
  );
}

// ââ Per-site access control accordion ââââââââââââââââââââââââââââââââââââââââ
function SiteAccessRow({ site, onToggleRole, onToggle }) {
  const lockedRoles = ["Company Admin", "Site Manager"];

  return (
    <div style={{
      border: "1.5px solid #E2EBE6",
      borderRadius: 8, overflow: "hidden", marginBottom: 8,
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", cursor: "pointer",
          background: site.expanded ? C.foam : C.white,
          transition: "background .15s",
        }}
      >
        <div>
          <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.ink }}>
            ð {site.name}
          </div>
          <div style={{ fontSize: ".72rem", color: C.mist, marginTop: 2 }}>{site.location}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AccessSummaryPill roles={site.accessRoles} />
          <span style={{ color: C.mist, fontSize: ".8rem" }}>{site.expanded ? "â²" : "â¼"}</span>
        </div>
      </div>

      {/* Expanded body */}
      {site.expanded && (
        <div style={{ padding: "14px 16px", background: C.white, borderTop: "1px solid #E2EBE6" }}>
          <div style={{ fontSize: ".72rem", fontWeight: 600, color: C.mist, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Who can initiate triage at this site?
          </div>

          {/* Locked roles */}
          {lockedRoles.map(role => (
            <div key={role} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0", borderBottom: "1px solid #F0F4F2",
              opacity: 0.6,
            }}>
              <span style={{ fontSize: ".85rem", color: C.slate }}>{role}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: ".7rem", color: C.mist }}>Always on</span>
                <div style={{
                  width: 42, height: 24, borderRadius: 24,
                  background: C.sage, position: "relative",
                }}>
                  <div style={{
                    position: "absolute", width: 18, height: 18, borderRadius: "50%",
                    background: C.white, top: 3, left: 21,
                  }} />
                </div>
              </div>
            </div>
          ))}

          {/* Configurable roles */}
          {CONFIGURABLE_ROLES.map(role => {
            const checked = site.accessRoles.includes(role.id);
            return (
              <div key={role.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 0", borderBottom: "1px solid #F0F4F2",
              }}>
                <span style={{ fontSize: ".85rem", color: C.ink }}>{role.label}</span>
                <Toggle checked={checked} onChange={() => onToggleRole(site.id, role.id)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ââ Decision tree editor ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function QuestionEditor({ questions, onChange }) {
  const [newQ,   setNewQ]   = useState("");
  const [focused, setFocused] = useState(false);
  const nextId = questions.length + 1;

  function handleAdd() {
    if (!newQ.trim()) return;
    onChange([...questions, { id: nextId, text: newQ.trim() }]);
    setNewQ("");
  }

  function handleRemove(id) {
    onChange(questions.filter(q => q.id !== id));
  }

  function move(index, dir) {
    const arr = [...questions];
    const target = index + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    onChange(arr);
  }

  return (
    <div>
      {questions.map((q, i) => (
        <div key={q.id} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 0", borderBottom: "1px solid #F0F4F2",
        }}>
          {/* Reorder */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
            <button onClick={() => move(i, -1)} disabled={i === 0}
              style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#D0DEDB" : C.mist, fontSize: ".65rem", lineHeight: 1, padding: "1px 3px" }}>â²</button>
            <button onClick={() => move(i, 1)} disabled={i === questions.length - 1}
              style={{ background: "none", border: "none", cursor: i === questions.length - 1 ? "default" : "pointer", color: i === questions.length - 1 ? "#D0DEDB" : C.mist, fontSize: ".65rem", lineHeight: 1, padding: "1px 3px" }}>â¼</button>
          </div>
          {/* Question text */}
          <span style={{ flex: 1, fontSize: ".85rem", color: C.ink }}>{q.text}</span>
          {/* Remove */}
          <button onClick={() => handleRemove(q.id)} style={{
            background: "none", border: "none", color: C.mist,
            cursor: "pointer", fontSize: ".95rem", padding: "2px 4px",
            borderRadius: 4, transition: "color .12s", flexShrink: 0,
          }}
            onMouseEnter={e => e.target.style.color = C.red}
            onMouseLeave={e => e.target.style.color = C.mist}
          >Ã</button>
        </div>
      ))}

      {/* Add question */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={newQ}
          onChange={e => setNewQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Add a custom step or questionâ¦"
          style={{
            flex: 1, padding: "8px 12px",
            border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
            borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
            fontSize: ".85rem", color: C.ink, outline: "none",
            boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
            transition: "all .18s",
          }}
        />
        <button onClick={handleAdd} style={{
          padding: "8px 14px", background: C.sage, color: C.white,
          border: "none", borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
          fontSize: ".82rem", fontWeight: 600, cursor: "pointer",
        }}>Add</button>
      </div>
    </div>
  );
}

// ââ Notification rules per outcome ââââââââââââââââââââââââââââââââââââââââââââ
function NotificationRulesEditor({ rules, onChange }) {
  const contacts = ["Site Manager", "ERC", "Safety Officer", "Company Admin"];

  return (
    <div>
      {OUTCOMES.map(outcome => (
        <div key={outcome} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: ".82rem", fontWeight: 600, color: C.ink, marginBottom: 8 }}>{outcome}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {contacts.map(contact => {
              const key     = `${outcome}:${contact}`;
              const checked = rules[key] ?? (outcome === "Call 911" && (contact === "Site Manager" || contact === "ERC"));
              return (
                <label key={contact} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 10px",
                  background: checked ? C.foam : C.chalk,
                  border: `1.5px solid ${checked ? C.mint : "#E2EBE6"}`,
                  borderRadius: 20, cursor: "pointer",
                  fontSize: ".78rem", color: checked ? C.pine : C.slate,
                  transition: "all .15s",
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange({ ...rules, [key]: !checked })}
                    style={{ display: "none" }}
                  />
                  {checked ? "â" : "â"} {contact}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ââ Main component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function S0fTriageSettings({ onBack, onSave }) {
  const [enabled,      setEnabled]      = useState(true);
  const [providerName, setProviderName] = useState("Concentra Occupational Health");
  const [providerPhone,setProviderPhone]= useState("(800) 555-0147");
  const [questions,    setQuestions]    = useState(SEED_QUESTIONS);
  const [notifRules,   setNotifRules]   = useState({});
  const [sites,        setSites]        = useState(SEED_SITES);
  const [saved,        setSaved]        = useState(false);
  const [pFocused,     setPFocused]     = useState(false);
  const [phFocused,    setPhFocused]    = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => { setSaved(false); onSave?.({ enabled, providerName, providerPhone, questions, notifRules, sites }); }, 1000);
  onHome,

  }

  function toggleSiteExpand(id) {
    setSites(ss => ss.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s));
  }

  function toggleSiteRole(siteId, roleId) {
    setSites(ss => ss.map(s => {
      if (s.id !== siteId) return s;
      const has = s.accessRoles.includes(roleId);
      let next  = has ? s.accessRoles.filter(r => r !== roleId) : [...s.accessRoles, roleId];
      // If "all" is selected, deselect others; if others selected, deselect "all"
      if (roleId === "all" && !has) next = ["all"];
      if (roleId !== "all" && !has) next = next.filter(r => r !== "all");
      return { ...s, accessRoles: next.length ? next : [roleId] };
    }));
  }

  const inputStyle = (focused) => ({
    width: "100%", padding: "9px 12px",
    border: `1.5px solid ${focused ? C.sage : "#D0DEDB"}`,
    borderRadius: 7, fontFamily: "'DM Sans', sans-serif",
    fontSize: ".88rem", color: C.ink, background: C.white, outline: "none",
    boxShadow: focused ? `0 0 0 3px rgba(74,140,92,.12)` : "none",
    transition: "all .18s",
  });

  return (
    <div style={{ minHeight: "100vh", background: C.chalk, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.mist}; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp .28s cubic-bezier(.4,0,.2,1) both; }
        .save-btn:hover:not(:disabled) { background: ${C.pine} !important; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(45,90,61,.3); }
      `}</style>

      {/* Top nav */}
      <div style={{
        height: 56, background: C.forest,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", boxShadow: "0 2px 12px rgba(0,0,0,.2)",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: ".95rem", fontWeight: 500, color: C.mint, letterSpacing: ".06em" }}>
          <span style={{ color: C.white }}>EHS</span>platform
        </div>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: C.mint,
          fontSize: ".83rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>â Back</button>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px" }}>

        <div className="anim" style={{ marginBottom: 22, animationDelay: "0ms" }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: C.ink }}>Triage Settings</h1>
          <p style={{ fontSize: ".85rem", color: C.mist, marginTop: 4 }}>
            Configure incident triage for your organization. Changes apply to all sites unless overridden per-site.
          </p>
        </div>

        {/* ââ On/off toggle ââ */}
        <div className="anim" style={{ animationDelay: "40ms" }}>
          <SectionCard title="Triage module" subtitle="Enable or disable the triage flow for your entire organization.">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: ".88rem", fontWeight: 600, color: C.ink }}>Triage flow enabled</div>
                <div style={{ fontSize: ".75rem", color: C.mist, marginTop: 2 }}>
                  Shows "Something happened" button to permitted staff
                </div>
              </div>
              <Toggle checked={enabled} onChange={setEnabled} />
            </div>
          </SectionCard>
        </div>

        {/* ââ Provider ââ */}
        <div className="anim" style={{ animationDelay: "60ms" }}>
          <SectionCard title="Triage provider" subtitle="The number shown to staff when the triage call outcome is reached. Leave blank if you don't have a retainer provider.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Label>Provider name</Label>
                <input
                  value={providerName}
                  onChange={e => setProviderName(e.target.value)}
                  onFocus={() => setPFocused(true)}
                  onBlur={() => setPFocused(false)}
                  placeholder="e.g. Concentra, MedCall"
                  style={inputStyle(pFocused)}
                />
              </div>
              <div>
                <Label>Phone number</Label>
                <input
                  value={providerPhone}
                  onChange={e => setProviderPhone(e.target.value)}
                  onFocus={() => setPhFocused(true)}
                  onBlur={() => setPhFocused(false)}
                  placeholder="(800) 000-0000"
                  style={inputStyle(phFocused)}
                />
              </div>
            </div>
            {!providerName && (
              <div style={{
                marginTop: 10, padding: "10px 14px",
                background: C.goldLt, borderLeft: `3px solid ${C.gold}`,
                borderRadius: 7, fontSize: ".8rem", color: "#7A5A1A", lineHeight: 1.5,
              }}>
                â  No provider configured. OSHA guidance will still be shown â staff will be directed to seek assessment via occupational health or telehealth before outside care.
              </div>
            )}
          </SectionCard>
        </div>

        {/* ââ Decision tree ââ */}
        <div className="anim" style={{ animationDelay: "80ms" }}>
          <SectionCard title="Decision tree questions" subtitle="Add, remove, or reorder questions. Default set provided â customize for your sites.">
            <QuestionEditor questions={questions} onChange={setQuestions} />
          </SectionCard>
        </div>

        {/* ââ Notification rules ââ */}
        <div className="anim" style={{ animationDelay: "100ms" }}>
          <SectionCard title="Notification rules" subtitle="Who gets alerted automatically based on outcome. Configurable per outcome.">
            <NotificationRulesEditor rules={notifRules} onChange={setNotifRules} />
          </SectionCard>
        </div>

        {/* ââ Access control per site ââ */}
        <div className="anim" style={{ animationDelay: "120ms" }}>
          <SectionCard
            title="Triage access control"
            subtitle="Which roles can initiate triage at each site. Company Admin and Site Manager always have access."
          >
            {sites.map(site => (
              <SiteAccessRow
                key={site.id}
                site={site}
                onToggle={() => toggleSiteExpand(site.id)}
                onToggleRole={toggleSiteRole}
              />
            ))}
          </SectionCard>
        </div>

      </div>

      {/* Fixed action bar */}
      <div style={{
        position: "fixed", bottom: 68, left: 0, right: 0,
        background: C.white, borderTop: "1px solid #E2EBE6",
        padding: "14px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 50, boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
      }}>
        <span style={{ fontSize: ".8rem", color: C.mist }}>
          Changes apply immediately on save
        </span>
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={saved}
          style={{
            padding: "10px 24px",
            background: saved ? C.sage + "99" : C.sage,
            color: C.white, border: "none", borderRadius: 7,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: ".88rem", fontWeight: 600,
            cursor: saved ? "default" : "pointer",
            transition: "all .18s",
          }}
        >{saved ? "â Saved" : "Save settings"}</button>
      </div>
    </div>
  );
}
