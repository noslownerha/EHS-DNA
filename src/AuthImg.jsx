import { useEffect, useState } from "react";
import { getToken } from "./api.js";

/**
 * Renders a photo served from the authenticated /api/photos/:id endpoint.
 *
 * A plain <img src="/api/photos/x"> cannot work here: image requests don't carry
 * the Authorization header, so the server would reject them. Instead we fetch the
 * bytes with the token, wrap them in an object URL, and hand that to <img>. The
 * object URL is revoked on unmount so we don't leak blobs as the user pages
 * through reports.
 *
 * Older records may still hold an inline base64 dataUrl (pre-migration); those are
 * rendered directly, so nothing breaks while the migration catches up.
 */
export default function AuthImg({ photo, alt, style, onClick }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl = null;

    // Legacy inline photo — use it as-is.
    if (photo?.dataUrl) { setSrc(photo.dataUrl); return; }
    if (!photo?.id) { setFailed(true); return; }

    fetch(`/api/photos/${encodeURIComponent(photo.id)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => { if (!revoked) setFailed(true); });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo?.id, photo?.dataUrl]);

  if (failed) {
    return (
      <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#EEF1F0", color: "#8FA3A0", fontSize: ".7rem" }}>
        Unavailable
      </div>
    );
  }

  if (!src) {
    // Placeholder while the bytes are in flight — keeps the layout from jumping.
    return <div style={{ ...style, background: "#EEF1F0" }} />;
  }

  return <img src={src} alt={alt} style={style} onClick={onClick} />;
}
