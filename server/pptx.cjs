/**
 * PowerPoint (.pptx) → course slides.
 *
 * A .pptx is a zip of XML. For each slide, in presentation order:
 *   heading  ← the title placeholder (title / ctrTitle)
 *   body     ← every other text box, one line per paragraph, "• " for bulleted
 *              paragraphs; if the slide has almost no text but has speaker
 *              notes, the notes are used (many training decks keep the real
 *              content in the notes)
 *   image    ← the first raster picture (png/jpeg/gif/webp); vector formats
 *              (emf/wmf/svg) are skipped and counted so the UI can say so
 *
 * Pure parsing only — storing images is the caller's job (storeImage callback),
 * so this stays unit-testable. Never executes anything from the file.
 */
const JSZip = require("jszip");

const MAX_SLIDES = 200;
const decode = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
                     .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");

function relsMap(xml) {
  const map = {};
  for (const m of (xml || "").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    const type = /\bType="([^"]+)"/.exec(m[0])?.[1] || "";
    if (id && target) map[id] = { target, type };
  }
  return map;
}
function resolve(base, target) {           // "ppt/slides/slide1.xml" + "../media/image1.png"
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop(); else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
function paragraphs(xml) {
  const out = [];
  for (const p of (xml || "").matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
    const text = [...p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(t => decode(t[1])).join("").trim();
    if (!text) continue;
    const bullet = /<a:buChar\b|<a:buAutoNum\b/.test(p[1]) || /<a:pPr[^>]*\blvl="[1-9]"/.test(p[1]);
    out.push(bullet ? `• ${text}` : text);
  }
  return out;
}

async function parsePptx(buffer, { storeImage } = {}) {
  let zip;
  try { zip = await JSZip.loadAsync(buffer); }
  catch { throw new Error("That file isn't a readable PowerPoint (.pptx). Old .ppt files must be re-saved as .pptx."); }
  const read = p => zip.file(p)?.async("string");
  const pres = await read("ppt/presentation.xml");
  if (!pres) throw new Error("That file isn't a PowerPoint (.pptx) presentation.");

  // Slide order comes from presentation.xml, not file names (slide10 < slide2).
  const presRels = relsMap(await read("ppt/_rels/presentation.xml.rels"));
  const order = [...pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)]
    .map(m => presRels[m[1]]?.target).filter(Boolean).map(t => resolve("ppt/presentation.xml", t));

  const core = await read("docProps/core.xml");
  const docTitle = core ? decode(/<dc:title>([\s\S]*?)<\/dc:title>/.exec(core)?.[1] || "").trim() : "";

  const slides = []; let skippedImages = 0, notesUsed = 0;
  for (const path of order.slice(0, MAX_SLIDES)) {
    const xml = await read(path);
    if (!xml) continue;
    const relsPath = path.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
    const rels = relsMap(await read(relsPath));

    let heading = ""; const body = [];
    for (const sp of xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)) {
      const isTitle = /<p:ph\b[^>]*type="(title|ctrTitle)"/.test(sp[0]);
      const paras = paragraphs(sp[0]);
      if (isTitle && !heading) heading = paras.join(" ");
      else body.push(...paras);
    }
    // Decks built without title placeholders (Canva, Google Slides exports,
    // hand-drawn text boxes): the first short line is almost always the title.
    if (!heading && body.length && body[0].replace(/^• /, "").length <= 90) heading = body.shift().replace(/^• /, "");
    // Tables: keep their text rather than dropping it.
    for (const tbl of xml.matchAll(/<a:tbl\b[\s\S]*?<\/a:tbl>/g)) {
      for (const row of tbl[0].matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)) {
        const cells = [...row[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map(c => paragraphs(c[0]).join(" ")).filter(Boolean);
        if (cells.length) body.push(cells.join(" | "));
      }
    }

    // Speaker notes
    let notes = "";
    const notesRel = Object.values(rels).find(r => r.type.endsWith("/notesSlide"));
    if (notesRel) {
      const nxml = await read(resolve(path, notesRel.target));
      const sps = [...(nxml || "").matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)]
        .filter(sp => /<p:ph\b[^>]*type="body"/.test(sp[0]));
      notes = sps.flatMap(sp => paragraphs(sp[0])).join("\n").trim();
    }
    let text = body.join("\n").trim();
    if (text.length < 40 && notes) { text = [text, notes].filter(Boolean).join("\n\n"); notesUsed++; }

    // First raster image on the slide
    let imageId = null;
    const pic = xml.match(/<p:pic\b[\s\S]*?r:embed="([^"]+)"/);
    if (pic && rels[pic[1]]) {
      const mediaPath = resolve(path, rels[pic[1]].target);
      const ext = mediaPath.split(".").pop().toLowerCase();
      const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[ext];
      if (mime && storeImage) {
        const b64 = await zip.file(mediaPath)?.async("base64");
        imageId = b64 ? storeImage({ dataUrl: `data:${mime};base64,${b64}`, name: mediaPath.split("/").pop() }) : null;
        if (!imageId) skippedImages++;
      } else if (pic) skippedImages++;
    }

    if (!heading && !text && !imageId) continue;   // blank divider slides
    slides.push({ heading: heading || `Slide ${slides.length + 1}`, body: text, videoUrl: "", imageId });
  }
  if (!slides.length) throw new Error("No slides with text or pictures were found in that file.");
  return { title: docTitle || slides[0].heading, slides, skippedImages, notesUsed, truncated: order.length > MAX_SLIDES };
}

module.exports = { parsePptx };
