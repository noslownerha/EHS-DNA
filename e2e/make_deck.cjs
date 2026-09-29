// Builds a realistic test deck: placeholder-less titles, bullets with special
// characters, a picture, a table, a notes-only slide, a blank divider, >9 slides.
const PptxGenJS = require("pptxgenjs");
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
(async () => {
  const p = new PptxGenJS(); p.title = "Forklift Safety Refresher";
  let s = p.addSlide(); s.addText("Forklift Safety Refresher", { x: .5, y: .5, w: 9, h: 1 });
  s = p.addSlide(); s.addText("Pre-use inspection", { x: .5, y: .3, w: 9, h: .8 });
  s.addText([{ text: "Check forks for cracks", options: { bullet: true } }, { text: "Test horn & lights", options: { bullet: true } }], { x: .5, y: 1.2, w: 6, h: 3 });
  s.addImage({ data: "image/png;base64," + PNG, x: 7, y: 1, w: 2, h: 2 });
  s = p.addSlide(); s.addText("Load limits", { x: .5, y: .3, w: 9, h: .8 });
  s.addTable([[{ text: "Truck" }, { text: "Capacity" }], [{ text: "FL-07" }, { text: "5,000 lb" }]], { x: .5, y: 1.3, w: 6 });
  p.addSlide();
  s = p.addSlide(); s.addText("Stability", { x: .5, y: .3, w: 9, h: .8 }); s.addNotes("Explain the stability triangle and the load centre.");
  for (let i = 0; i < 6; i++) p.addSlide().addText(`Extra slide ${i + 6}`, { x: .5, y: .5, w: 9, h: 1 });
  require("fs").writeFileSync(process.argv[2], await p.write({ outputType: "nodebuffer" }));
})();
