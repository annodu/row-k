import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manualIndexPath = path.resolve(__dirname, "../data/manual-salons.json");

export const categoryMap = {
  "braiding-services": ["Boho braids / goddess braids","Braid take-down","Box braids","Crochet","Creative braids","Feed-in braids","French curl","Fulani / lemonade braids","Half braids, half sew-in","Knotless braids","Miracle knots","Microbraids / x-small braids","Pre-parting","Stitch braids","Twists (with extensions)"],
  "colour-services": ["Balayage","Full head colour","Highlights","Wig colouring / bundle colouring"],
  "bridal-services": ["Bridal"],
  "editorial-services": ["Editorial / Session styling"],
  "extension-services": ["Clip ins (+ silk press)","K-tips / invisible strands","LA weave / microlinks wefts / braidless sew in","I-tips / microlinks strands","Tape ins"],
  "locs-services": ["Butterfly locs","Faux locs","Microlocs / sisterlocs","Retwist","Starter locs"],
  "sew-in-weave": ["Closure sew-in","Flipover / versatile sew-in","Frontal sew-in","Hybrid sew in (tapes + sew in)","Pixie wig / weave install","Quick weave","Sew-in take-down","Tracks (+ silk press) / partial / invisible sew-in","Traditional sew-in / leave out"],
  "styling-services": ["Sew in / extensions blowdry","Frontal ponytail / bun","Half up half down","Pixie / finger waves","Sleek ponytail / bun","Updo"],
  "straightening-treatments": ["Hair botox","Japanese straightening","K-18 treatment","Keratin treatment","Moisturising treatment","Olaplex treatment","Relaxer / texturiser","Texture release"],
  "natural-hair-services": ["Wig cornrows","Curly cut / wash & go / diffuse","Silk press","Bouncy blowout / round brush blow dry","Trim / hair cut","Roller set","Twist out / flexi rod","Wash & blowdry","Japanese head spa","Scalp detox / treatments"],
  "natural-hair-scalp-health": ["Healthy hair plans & consultations","Natural hair coaches / educators","Trichology / scalp analysis"],
  "wig-services": ["Custom wig","Pixie wig / weave install","U-part wig install","Wig colouring / bundle colouring","Wig install (frontal / closure)","Wig blowdry"],
};

export const serviceAliases = {
  "Curly cut / wash & go": "Curly cut / wash & go / diffuse",
  "Custom made frontal unit": "Custom wig",
  "Custom made closure unit": "Custom wig",
  "Custom handmade wig": "Custom wig",
  "Custom handmade wigs": "Custom wig",
  "Custom Handmade Wig": "Custom wig",
  "Custom Handmade Wigs": "Custom wig",
  "Bespoke wig": "Custom wig",
  "Bespoke wigs": "Custom wig",
  "bespoke wig": "Custom wig",
  "bespoke wigs": "Custom wig",
  "Custom frontal unit": "Custom wig",
  "Custom closure unit": "Custom wig",
  "Customised closure unit": "Custom wig",
  "Customised Closure unit": "Custom wig",
  "Customised Closure Unit": "Custom wig",
  "Customized closure unit": "Custom wig",
  "Customized Closure Unit": "Custom wig",
  "Custom Mini Frontal Unit": "Custom wig",
  "Custom mini frontal unit": "Custom wig",
  "Custom frontal/closure units": "Custom wig",
  "Custom frontal / closure units": "Custom wig",
  "Custom frontal wig unit": "Custom wig",
  "Custom closure wig unit": "Custom wig",
  "Frontal unit": "Wig install (frontal / closure)",
  "Closure unit": "Wig install (frontal / closure)",
  "Wig making": "Custom wig",
  "wig making": "Custom wig",
  "Wig construction": "Custom wig",
  "Wig Customising": "Custom wig",
  "Wig customising": "Custom wig",
  "wig customising": "Custom wig",
  "Wig customisation": "Custom wig",
  "wig customisation": "Custom wig",
  "Wig customization": "Custom wig",
  "wig customization": "Custom wig",
  "Unit Customisation": "Custom wig",
  "Unit customisation": "Custom wig",
  "unit customisation": "Custom wig",
  "Unit Customization": "Custom wig",
  "Unit customization": "Custom wig",
  "unit customization": "Custom wig",
  "Construction and Customisation": "Custom wig",
  "Construction and Customization": "Custom wig",
  "construction and customisation": "Custom wig",
  "construction and customization": "Custom wig",
  "Tracks / Silk press + tracks": "Tracks (+ silk press) / partial / invisible sew-in",
  "Tracks (per row)": "Tracks (+ silk press) / partial / invisible sew-in",
  "Rows of tracks": "Tracks (+ silk press) / partial / invisible sew-in",
  "Rows of Tracks": "Tracks (+ silk press) / partial / invisible sew-in",
  "Silk press + tracks": "Tracks (+ silk press) / partial / invisible sew-in",
  "Silk press with tracks": "Tracks (+ silk press) / partial / invisible sew-in",
  "Silk press add on tracks": "Tracks (+ silk press) / partial / invisible sew-in",
  "Silk press add-on tracks": "Tracks (+ silk press) / partial / invisible sew-in",
  "Tracks add on": "Tracks (+ silk press) / partial / invisible sew-in",
  "Tracks add-on": "Tracks (+ silk press) / partial / invisible sew-in",
  "Tracks (+ Silk press) / Partial / Invisible sew-in": "Tracks (+ silk press) / partial / invisible sew-in",
  "Sew in tracks": "Tracks (+ silk press) / partial / invisible sew-in",
  "Sew-in Tracks": "Tracks (+ silk press) / partial / invisible sew-in",
  "Sew-in Tracks £8per line": "Tracks (+ silk press) / partial / invisible sew-in",
  "Single track weave": "Tracks (+ silk press) / partial / invisible sew-in",
  "Single /double track weave": "Tracks (+ silk press) / partial / invisible sew-in",
  "Tracks / Silk press + tracks / Invisible sew-in": "Tracks (+ silk press) / partial / invisible sew-in",
  "Tracks / Silk press + tracks / Partial sew-in": "Tracks (+ silk press) / partial / invisible sew-in",
  "Invisible sew-in": "Tracks (+ silk press) / partial / invisible sew-in",
  "Invisible sew in": "Tracks (+ silk press) / partial / invisible sew-in",
  "Invisible sewin": "Tracks (+ silk press) / partial / invisible sew-in",
  "Invisible sew-ins": "Tracks (+ silk press) / partial / invisible sew-in",
  "Invisible sew ins": "Tracks (+ silk press) / partial / invisible sew-in",
  "Invisible weft": "Tracks (+ silk press) / partial / invisible sew-in",
  "Invisible wefts": "Tracks (+ silk press) / partial / invisible sew-in",
  "Invisible Weft": "Tracks (+ silk press) / partial / invisible sew-in",
  "Invisible Wefts": "Tracks (+ silk press) / partial / invisible sew-in",
  "Partial sew-in": "Tracks (+ silk press) / partial / invisible sew-in",
  "Partial sew in": "Tracks (+ silk press) / partial / invisible sew-in",
  "Partial sew-in (w/ leave out)": "Tracks (+ silk press) / partial / invisible sew-in",
  "Partial sew in (w/ leave out)": "Tracks (+ silk press) / partial / invisible sew-in",
  "Closure sew-in": "Closure sew-in",
  "Closure sew in": "Closure sew-in",
  "closure sew-in": "Closure sew-in",
  "closure sew in": "Closure sew-in",
  "Closure- behind the hairline": "Closure sew-in",
  "Closure behind the hairline": "Closure sew-in",
  "Clip ins (+ Silk press)": "Clip ins (+ silk press)",
  "Clip-ins": "Clip ins (+ silk press)",
  "Clip ins": "Clip ins (+ silk press)",
  "Clip ins / Silk press + Clip ins": "Clip ins (+ silk press)",
  "Silk press + clip-ins": "Clip ins (+ silk press)",
  "Silk press + Clip ins": "Clip ins (+ silk press)",
  "Silk press with clip-ins": "Clip ins (+ silk press)",
  "Silk press with Clip ins": "Clip ins (+ silk press)",
  "Tape ins / Silk press + Tape ins": "Tape ins",
  "Tape-ins": "Tape ins",
  "Tape Ins": "Tape ins",
  "Tape in": "Tape ins",
  "Tape-in": "Tape ins",
  Tapes: "Tape ins",
  tapes: "Tape ins",
  "Tape-Ins & Installs": "Tape ins",
  "Tape-ins & Installs": "Tape ins",
  "Extensions / wig blowdry": "Sew in / extensions blowdry",
  "Extensions blowdry": "Sew in / extensions blowdry",
  "Extensions blowout": "Sew in / extensions blowdry",
  "Extension blowdry": "Sew in / extensions blowdry",
  "Extension blowout": "Sew in / extensions blowdry",
  "Blowdry with extensions": "Sew in / extensions blowdry",
  "Blow dry with extensions": "Sew in / extensions blowdry",
  "Blowout with extensions": "Sew in / extensions blowdry",
  "Weave blowdry": "Sew in / extensions blowdry",
  "Weave blow dry": "Sew in / extensions blowdry",
  "Weave blowout": "Sew in / extensions blowdry",
  "Weave blow out": "Sew in / extensions blowdry",
  "Sew in blowdry": "Sew in / extensions blowdry",
  "Sew in blow dry": "Sew in / extensions blowdry",
  "Sew-in blowdry": "Sew in / extensions blowdry",
  "Sew-in blow dry": "Sew in / extensions blowdry",
  "Sewin blowdry": "Sew in / extensions blowdry",
  "Sewin blow dry": "Sew in / extensions blowdry",
  "Sew in blowout": "Sew in / extensions blowdry",
  "Sew in blow out": "Sew in / extensions blowdry",
  "K tips blowdry": "Sew in / extensions blowdry",
  "K-tips blowdry": "Sew in / extensions blowdry",
  "Ktips blowdry": "Sew in / extensions blowdry",
  "K tips blow dry": "Sew in / extensions blowdry",
  "K-tips blow dry": "Sew in / extensions blowdry",
  "Ktips blow dry": "Sew in / extensions blowdry",
  "Blow out on sew in weave": "Sew in / extensions blowdry",
  "Blowout on sew in weave": "Sew in / extensions blowdry",
  "Wash and blowdry with extensions": "Sew in / extensions blowdry",
  "Wash and blow dry with extensions": "Sew in / extensions blowdry",
  "Wash & blowdry with extensions": "Sew in / extensions blowdry",
  "Wash & Blow dry with Extensions": "Sew in / extensions blowdry",
  "LA weave / microlinks wefts / braidless sew in": "LA weave",
  "Microlinks wefts": "LA weave",
  "Micro links wefts": "LA weave",
  "Braidless sew-in": "LA weave",
  "Braidless sew in": "LA weave",
  "I-tips / microlinks strands": "Microlinks",
  "I-tips": "Microlinks",
  "I tips": "Microlinks",
  "Microlinks strands": "Microlinks",
  "Micro links strands": "Microlinks",
  "Flipover sew-in": "Flipover / versatile sew-in",
  "Boho braids / microbraids": "Boho braids / goddess braids",
  "Boho braids / goddess braids": "Boho braids / goddess braids",
  "Goddess braids": "Boho braids / goddess braids",
  "Feed in braids": "Feed-in braids",
  "Feed-in braids": "Feed-in braids",
  "Braids going back": "Feed-in braids",
  "braids going back": "Feed-in braids",
  "Cornrows incl extensions": "Feed-in braids",
  "Cornrows (incl extensions)": "Feed-in braids",
  "Cornrows with extensions": "Feed-in braids",
  "French curl braids": "French curl",
  "Creative braids": "Creative braids",
  Patewo: "Creative braids",
  "Dolly braids": "Creative braids",
  "Dolly Braids": "Creative braids",
  Shuku: "Creative braids",
  shuku: "Creative braids",
  "Koroba braids": "Creative braids",
  "Koroba Braids": "Creative braids",
  "Fulani braids": "Fulani / lemonade braids",
  "Fulani / Lemonade braids": "Fulani / lemonade braids",
  Fulani: "Fulani / lemonade braids",
  "Lemonade braids": "Fulani / lemonade braids",
  "Alicia Keys braids": "Fulani / lemonade braids",
  "Alicia keys braids": "Fulani / lemonade braids",
  "Miracle knot": "Miracle knots",
  "Kinky twists": "Twists (with extensions)",
  "Kinky Twists": "Twists (with extensions)",
  "Rope twists": "Twists (with extensions)",
  "Rope Twists": "Twists (with extensions)",
  "Senegalese twists": "Twists (with extensions)",
  "Senegalese Twists": "Twists (with extensions)",
  "Marley twists": "Twists (with extensions)",
  "Marley Twists": "Twists (with extensions)",
  "Island Twist": "Twists (with extensions)",
  "Island twist": "Twists (with extensions)",
  "Island twists": "Twists (with extensions)",
  "Large Twist": "Twists (with extensions)",
  "Large Twists": "Twists (with extensions)",
  Microbraids: "Microbraids / x-small braids",
  microbraids: "Microbraids / x-small braids",
  "X-small braids": "Microbraids / x-small braids",
  "x-small braids": "Microbraids / x-small braids",
  Ponytail: "Sleek ponytail / bun",
  "Ponytail / bun": "Sleek ponytail / bun",
  "Ponytail / updo": "Updo",
  "Sleek ponytail": "Sleek ponytail / bun",
  "Sleek ponytail / updo": "Updo",
  "Sleek ponytails": "Sleek ponytail / bun",
  "Sleek bun": "Sleek ponytail / bun",
  "Sleek updo": "Updo",
  Updo: "Updo",
  "French roll up": "Updo",
  "French Roll Up": "Updo",
  "French roll": "Updo",
  "French Roll": "Updo",
  "Frontal ponytail": "Frontal ponytail / bun",
  "Frontal ponytails": "Frontal ponytail / bun",
  "Frontal ponytail updo": "Updo",
  "Frontal ponytail / updo": "Updo",
  "Frontal ponytail / bun": "Frontal ponytail / bun",
  "Frontal ponytail / bun / updo": "Frontal ponytail / bun",
  "Sleek ponytail / bun": "Sleek ponytail / bun",
  "Sleek ponytail / bun / updo": "Sleek ponytail / bun",
  Bun: "Sleek ponytail / bun",
  "Crochet braids": "Crochet",
  Cornrows: "Wig cornrows",
  "Cornrows / Twists": "Wig cornrows",
  "Cornrows / Twists / Underwig cornrows": "Wig cornrows",
  "Underwig cornrows": "Wig cornrows",
  "Under wig cornrows": "Wig cornrows",
  "Healthy hair plan": "Healthy hair plans & consultations",
  "Healthy hair plans": "Healthy hair plans & consultations",
  "Healthy hair plans & consultations": "Healthy hair plans & consultations",
  "Healthy hair regime": "Healthy hair plans & consultations",
  "Healthy hair regimes": "Healthy hair plans & consultations",
  "Healthy hair consultation": "Healthy hair plans & consultations",
  "Healthy hair consultations": "Healthy hair plans & consultations",
  "Healthy hair consultation & regime": "Healthy hair plans & consultations",
  "Healthy hair consultations & regimes": "Healthy hair plans & consultations",
  "Healthy hair regimen": "Healthy hair plans & consultations",
  "Healthy hair regimens": "Healthy hair plans & consultations",
  "Healthy hair consultation & regimen": "Healthy hair plans & consultations",
  "Healthy hair consultations & regimens": "Healthy hair plans & consultations",
  "Hair regime": "Healthy hair plans & consultations",
  "Hair regimen": "Healthy hair plans & consultations",
  "Hair growth plan": "Healthy hair plans & consultations",
  "Hair health plan": "Healthy hair plans & consultations",
  "Natural hair education": "Natural hair coaches / educators",
  "Natural hair coaches": "Natural hair coaches / educators",
  "Natural hair coaches / Trichologists": "Natural hair coaches / educators",
  "Trichologist": "Trichology / scalp analysis",
  "Trichologists": "Trichology / scalp analysis",
  "Trichology": "Trichology / scalp analysis",
  "Trichology / scalp analysis": "Trichology / scalp analysis",
  "Natural hair coaches / educators": "Natural hair coaches / educators",
  "Scalp care": "Scalp detox / treatments",
  "Scalp Care": "Scalp detox / treatments",
  "Scalp therapy": "Scalp detox / treatments",
  "Scalp Therapy": "Scalp detox / treatments",
  "Scalp treatment": "Scalp detox / treatments",
  "Scalp Treatment": "Scalp detox / treatments",
  "Scalp treatments": "Scalp detox / treatments",
  "Scalp scrub": "Scalp detox / treatments",
  "Scalp Scrub": "Scalp detox / treatments",
  "Scalp detox": "Scalp detox / treatments",
  "Scalp Detox": "Scalp detox / treatments",
  "Scalp detox / treatments": "Scalp detox / treatments",
  "Scalp detox / scalp scrub": "Scalp detox / treatments",
  "Scalp Detox / Scalp scrub": "Scalp detox / treatments",
  "Scalp Detox / Scalp Scrub": "Scalp detox / treatments",
  "Scalp rejuvenation": "Scalp detox / treatments",
  "Scalp Rejuvenation": "Scalp detox / treatments",
  "Scalp renewal": "Scalp detox / treatments",
  "Scalp Renewal": "Scalp detox / treatments",
  "Exfoliating scalp salt scrub": "Scalp detox / treatments",
  "Exfoliating Scalp Salt Scrub": "Scalp detox / treatments",
  "Braid takedown": "Braid take-down",
  "Natural hair care": "Moisturising treatment",
  Relaxer: "Relaxer / texturiser",
  Texturiser: "Relaxer / texturiser",
  Texturizer: "Relaxer / texturiser",
  Colour: "Full head colour",
  "Permanent colour": "Full head colour",
  "Permanent tint": "Full head colour",
  "Wig colouring / Bundle colouring": "Wig colouring / bundle colouring",
  "Hair Botox": "Hair botox",
  "Half braid": "Half braids, half sew-in",
  "Half weave": "Half braids, half sew-in",
  "Half braid / Half weave": "Half braids, half sew-in",
  "K18 treatment": "K-18 treatment",
  "K-tips / Invisible strands": "K-tips / invisible strands",
  "Keratin tip": "K-tips / invisible strands",
  "Keratin tips": "K-tips / invisible strands",
  "keratin tip": "K-tips / invisible strands",
  "keratin tips": "K-tips / invisible strands",
  "Wash & go": "Curly cut / wash & go",
  "Wash & go / Curly cut": "Curly cut / wash & go",
  "Curly cut / Wash & go": "Curly cut / wash & go",
  "Curly cut": "Curly cut / wash & go",
  "Wash & blowdry / Blowout": "Wash & blowdry",
  "Washing / blow drying of hair": "Wash & blowdry",
  Blowout: "Wash & blowdry",
  "Extensions blowdry": "Sew in / extensions blowdry",
  "Extensions blowout": "Sew in / extensions blowdry",
  "Extension blowdry": "Sew in / extensions blowdry",
  "Extension blowout": "Sew in / extensions blowdry",
  "Blowdry with extensions": "Sew in / extensions blowdry",
  "Blow dry with extensions": "Sew in / extensions blowdry",
  "Blowout with extensions": "Sew in / extensions blowdry",
  "Weave blowdry": "Sew in / extensions blowdry",
  "Weave blow dry": "Sew in / extensions blowdry",
  "Weave blowout": "Sew in / extensions blowdry",
  "Weave blow out": "Sew in / extensions blowdry",
  "Sew in blowdry": "Sew in / extensions blowdry",
  "Sew in blow dry": "Sew in / extensions blowdry",
  "Sew-in blowdry": "Sew in / extensions blowdry",
  "Sew-in blow dry": "Sew in / extensions blowdry",
  "Sewin blowdry": "Sew in / extensions blowdry",
  "Sewin blow dry": "Sew in / extensions blowdry",
  "Sew in blowout": "Sew in / extensions blowdry",
  "Sew in blow out": "Sew in / extensions blowdry",
  "K tips blowdry": "Sew in / extensions blowdry",
  "K-tips blowdry": "Sew in / extensions blowdry",
  "Ktips blowdry": "Sew in / extensions blowdry",
  "K tips blow dry": "Sew in / extensions blowdry",
  "K-tips blow dry": "Sew in / extensions blowdry",
  "Ktips blow dry": "Sew in / extensions blowdry",
  "Blow out on sew in weave": "Sew in / extensions blowdry",
  "Blowout on sew in weave": "Sew in / extensions blowdry",
  "Wash and blowdry with extensions": "Sew in / extensions blowdry",
  "Wash and blow dry with extensions": "Sew in / extensions blowdry",
  "Wash & blowdry with extensions": "Sew in / extensions blowdry",
  "Wash & Blow dry with Extensions": "Sew in / extensions blowdry",
  "Bouncy blowout": "Bouncy blowout / round brush blow dry",
  "Bouncy blow out": "Bouncy blowout / round brush blow dry",
  "Bouncy blowdry": "Bouncy blowout / round brush blow dry",
  "Bouncy blow dry": "Bouncy blowout / round brush blow dry",
  "Bouncy blow-dry": "Bouncy blowout / round brush blow dry",
  "Round brush blow dry": "Bouncy blowout / round brush blow dry",
  "Round brush blowdry": "Bouncy blowout / round brush blow dry",
  "Dry bouncy blow-dry": "Bouncy blowout / round brush blow dry",
  "Head spa": "Japanese head spa",
  "Japanese head spa treatment": "Japanese head spa",
  "Silk press / Bouncy blowout": "Silk press",
  "Silk press / bouncy blowout": "Silk press",
  "Silk press / Finish": "Silk press",
  "Hair cut": "Trim / hair cut",
  "Hair cut / Trim": "Trim / hair cut",
  "Trim / Hair cut": "Trim / hair cut",
  Trim: "Trim / hair cut",
  "Twist out / Flexi rod": "Twist out / flexi rod",
  "Wig install": "Wig install (frontal / closure)",
  "Wig installation": "Wig install (frontal / closure)",
  "wig installation": "Wig install (frontal / closure)",
  "Wig frontal install": "Wig install (frontal / closure)",
  "Wig closure install": "Wig install (frontal / closure)",
  "Glueless wig": "Wig install (frontal / closure)",
  "Unit Install": "Wig install (frontal / closure)",
  "Unit install": "Wig install (frontal / closure)",
  "unit install": "Wig install (frontal / closure)",
  "Ready-Made Unit": "Wig install (frontal / closure)",
  "Ready Made Unit": "Wig install (frontal / closure)",
  "ready-made unit": "Wig install (frontal / closure)",
  "ready made unit": "Wig install (frontal / closure)",
  "Frontal Unit Install": "Wig install (frontal / closure)",
  "Frontal unit install": "Wig install (frontal / closure)",
  "frontal unit install": "Wig install (frontal / closure)",
  "Closure Unit Install": "Wig install (frontal / closure)",
  "Closure unit install": "Wig install (frontal / closure)",
  "closure unit install": "Wig install (frontal / closure)",
  "U-Part wig install": "U-part wig install",
  "U Part Wig": "U-part wig install",
  "U-Part Wig": "U-part wig install",
  "U-Part wig": "U-part wig install",
  "U-part wig": "U-part wig install",
  "U-Part": "U-part wig install",
  "U-part": "U-part wig install",
  "u-part": "U-part wig install",
  Upart: "U-part wig install",
  upart: "U-part wig install",
  "U part": "U-part wig install",
  "u part": "U-part wig install",
  "Middle part U part": "U-part wig install",
  "Side part Upart": "U-part wig install",
  "Pixie wig install": "Pixie wig / weave install",
  "Pixie weave install": "Pixie wig / weave install",
  "PIXIE CUT WIG MAKING & STYLING": "Pixie wig / weave install",
  "Pixie cut": "Pixie / finger waves",
  "Pixie cut / wrap": "Pixie / finger waves",
  Wrap: "Pixie / finger waves",
  "Finger waves": "Pixie / finger waves",
  Bridal: "Bridal",
  "Bridal hair": "Bridal",
  "Bridal styling": "Bridal",
  "Editorial styling": "Editorial / Session styling",
  Editorial: "Editorial / Session styling",
  "Session styling": "Editorial / Session styling",
  "Microlocs / Sisterlocs": "Microlocs / sisterlocs",
  "Invisible locs": "Faux locs",
  "Invisible Locs": "Faux locs",
  "Soft locs": "Faux locs",
  "Soft Locs": "Faux locs",
  "Soft loc": "Faux locs",
  "Soft Loc": "Faux locs",
  "soft locs": "Faux locs",
  "soft loc": "Faux locs",
  "Micro locs": "Microlocs / sisterlocs",
  Microlocs: "Microlocs / sisterlocs",
  Sisterlocs: "Microlocs / sisterlocs",
};

export async function readSalonIndex() {
  const manualIndex = await readIndexFile(manualIndexPath, "manual");
  const normalizedSalons = manualIndex.salons
    .map((salon, addedIndex) => ({
      ...salon,
      addedIndex,
      services: normalizeServices(salon.services),
    }))
    .sort(compareRecentlyAdded);

  return {
    meta: {
      source: "manual",
      updatedAt: manualIndex.meta.updatedAt ?? null,
      count: normalizedSalons.length,
    },
    salons: normalizedSalons,
  };
}

export async function searchSalons({
  categories = [],
  subcategories = [],
  regions = ["all"],
  hijabiFriendly = false,
  canBraidWithoutGel = false,
} = {}) {
  const index = await readSalonIndex();
  const normalizedRegions = Array.isArray(regions) && regions.length > 0 ? regions : ["all"];
  const normalizedCategories = Array.isArray(categories) ? categories.filter(Boolean) : [];
  const normalizedSubcategories = Array.isArray(subcategories)
    ? subcategories.filter(Boolean).map((subcategory) => serviceAliases[subcategory] ?? subcategory)
    : [];

  const results = index.salons
    .filter(
      (salon) =>
        matchesRegion(salon, normalizedRegions) &&
        matchesServiceSelection(salon, normalizedCategories, normalizedSubcategories) &&
        matchesHijabiFriendly(salon, hijabiFriendly) &&
        matchesCanBraidWithoutGel(salon, canBraidWithoutGel),
    )
    .sort(compareRecentlyAdded);

  return {
    ok: true,
    total: results.length,
    results,
    indexMeta: index.meta,
  };
}

export function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

async function readIndexFile(filePath, source) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      meta: { source, updatedAt: null, count: 0 },
      salons: [],
    };
  }
}

function matchesRegion(salon, regions) {
  const areaIds = Array.isArray(salon.areaIds) ? salon.areaIds : salon.areaId ? [salon.areaId] : [];
  const londonAreas = new Set(["all-london", "central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"]);
  const selectedRegions = Array.isArray(regions) && regions.length > 0 ? regions : ["all"];

  if (selectedRegions.includes("all")) {
    return areaIds.length > 0;
  }

  return selectedRegions.some((region) => {
    if (region === "london") {
      return areaIds.some((areaId) => londonAreas.has(areaId));
    }

    return areaIds.includes(region);
  });
}

function matchesServiceSelection(salon, categories, subcategories) {
  const services = normalizeServices(salon.services);

  if ((!categories || categories.length === 0) && (!subcategories || subcategories.length === 0)) {
    return true;
  }

  const matchesCategories = (categories ?? []).every((category) => {
    const categoryServices = categoryMap[category] ?? [];
    return categoryServices.some((service) => services.includes(service));
  });

  if (!matchesCategories) {
    return false;
  }

  return (subcategories ?? []).every((subcategory) => services.includes(subcategory));
}

function matchesHijabiFriendly(salon, hijabiFriendly) {
  if (!hijabiFriendly) {
    return true;
  }

  return salon.hijabiFriendly === true;
}

function matchesCanBraidWithoutGel(salon, canBraidWithoutGel) {
  if (!canBraidWithoutGel) {
    return true;
  }

  return salon.canBraidWithoutGel === true;
}

function compareSalons(left, right) {
  const leftStartsWithDigit = /^\d/.test(left.name);
  const rightStartsWithDigit = /^\d/.test(right.name);

  if (leftStartsWithDigit !== rightStartsWithDigit) {
    return leftStartsWithDigit ? 1 : -1;
  }

  return left.name.localeCompare(right.name);
}

function compareRecentlyAdded(left, right) {
  return (right.addedIndex ?? 0) - (left.addedIndex ?? 0) || compareSalons(left, right);
}

export function normalizeServices(services = []) {
  return [...new Set(services.map((service) => serviceAliases[service] ?? service))];
}
