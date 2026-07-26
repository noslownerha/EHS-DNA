import { useState, useEffect, useRef } from "react";
import { COLORS as C } from "./constants.js";

/**
 * Searchable person picker.
 *
 * Replaces two worse patterns:
 *  - window.prompt + fuzzy text matching, which silently failed whenever the
 *    typed text didn't match a real name; and
 *  - a plain <select>, which is fine for a handful of people but becomes an
 *    unscrollable wall once a site has real headcount.
 *
 * Selection is always by id from the supplied roster — the search box only
 * filters what's shown, so it is never possible to "assign" a name that isn't
 * a real person.
 *
 * @param value    number|null   currently selected user id
 * @param options  [{id, name, role?, site?}]
 * @param onChange (idOrNull) => void
 */
export default function PersonPicker({
  value, options = [], onChange,
  placeholder = "Unassigned",
  allowUnassign = true,
  disabled = false,
  label = "Assign to",
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const selected = options.find(o => String(o.id) === String(value));
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter(o => (o.name ?? "").toLowerCase().includes(needle)
                       || (o.site ?? "").toLowerCase().includes(needle)
                       || (o.role ?? "").toLowerCase().includes(needle))
    : options;

  function choose(id) { onChange?.(id); setOpen(false); }

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", border: "1.5px solid #D0DEDB", borderRadius: 6,
        background: "#fff", color: selected ? C.ink : C.mist,
        fontFamily: "'DM Sans', sans-serif", fontSize: ".76rem", fontWeight: 600,
        cursor: disabled ? "default" : "pointer", maxWidth: 190,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {selected ? selected.name : placeholder}
        </span>
        <span style={{ color: C.mist, fontSize: ".65rem", flexShrink: 0 }}>▼</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(15,31,23,.45)", zIndex: 600,
          display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.white, borderRadius: "14px 14px 0 0", width: "100%", maxWidth: 520,
            maxHeight: "72vh", display: "flex", flexDirection: "column", padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: ".9rem", fontWeight: 700, color: C.ink }}>{label}</div>
              <button type="button" onClick={() => setOpen(false)} style={{
                background: "none", border: "none", color: C.mist, fontSize: ".8rem",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>Cancel</button>
            </div>

            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, site, or role…"
              // Autocorrect/autocapitalise actively harm a filter box on mobile —
              // and a mangled search term here only narrows the list, it can
              // never produce a wrong assignment, since selection is by id.
              autoCorrect="off" autoCapitalize="none" spellCheck={false}
              style={{
                width: "100%", padding: "10px 12px", border: "1.5px solid #D0DEDB",
                borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem",
                color: C.ink, outline: "none", marginBottom: 10, boxSizing: "border-box",
              }}
            />

            <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
              {allowUnassign && !needle && (
                <button type="button" onClick={() => choose(null)} style={rowStyle(value == null)}>
                  <span style={{ color: C.mist, fontStyle: "italic" }}>Unassigned</span>
                </button>
              )}
              {filtered.length === 0 ? (
                <div style={{ padding: "18px 10px", textAlign: "center", color: C.mist, fontSize: ".82rem" }}>
                  No one matches “{q.trim()}”.
                </div>
              ) : filtered.map(o => (
                <button key={o.id} type="button" onClick={() => choose(o.id)}
                  style={rowStyle(String(o.id) === String(value))}>
                  <span style={{ fontWeight: 600, color: C.ink }}>{o.name}</span>
                  {(o.site || o.role) && (
                    <span style={{ fontSize: ".72rem", color: C.mist, marginLeft: 8 }}>
                      {[o.site, o.role].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function rowStyle(isSelected) {
  return {
    display: "block", width: "100%", textAlign: "left",
    padding: "11px 10px", border: "none", borderRadius: 8,
    background: isSelected ? C.foam : "transparent",
    fontFamily: "'DM Sans', sans-serif", fontSize: ".86rem",
    cursor: "pointer", marginBottom: 2,
  };
}
