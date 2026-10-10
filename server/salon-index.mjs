import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setSecurityHeaders } from "./security.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manualIndexPath = path.resolve(__dirname, "../data/manual-salons.json");
const locationsPath = path.resolve(__dirname, "../data/locations.json");

const defaultRegionParentGroups = [
  { parentId: "all-london", childIds: ["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"] },
];
let regionParentGroups = defaultRegionParentGroups;

export function setRegionParentGroupsCache(groups) {
  if (Array.isArray(groups)) {
    regionParentGroups = groups;
  }
}

(async () => {
  try {
    const raw = await fs.readFile(locationsPath, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.parentGroups)) {
      regionParentGroups = data.parentGroups;
    }
  } catch {
    // keep default
  }
})();

const filtersPath = path.resolve(__dirname, "../data/filters.json");

const defaultCategoryMap = {
  "braiding-services": ["Boho braids / goddess braids","Braid take-down","Box braids","Colour blend (mixing braiding hair)","Crochet","Creative braids","Feed-in braids","French curl","Fulani / lemonade braids","Knotless braids","Miracle knots","Microbraids / x-small braids","Pre-parting","Stitch braids","Twists (with extensions)","Boho braids bob","French curl bob","Men's braids","Fulani sew-in / quick weave","Boho sew-in","Feed-in / stitch braid sew-in","Braided ponytail","Flip-over Fulani / diva braids","Alicia Keys braids","Pop smoke braids","Jayda Wayda braided sew-in","Cassie braided sew-in","Coi Leray braids","Tyla braids"],
  "colour-services": ["Balayage","Full head colour","Highlights","Wig colouring / bundle colouring"],
  "bridal-services": ["Bridal"],
  "editorial-services": ["Editorial / Session styling"],
  "kids-teens-services": ["Kids & teens styles"],
  "extension-services": ["Clip ins (+ silk press)","K-tips / invisible strands","LA weave / microlinks wefts / braidless sew in","I-tips / microlinks strands","Tape ins","Tape-ins + sew-in","K-tips + sew-in","Hair loss systems (e.g. mesh)","Extensions blow-dry / bouncy blowout","Extensions styling only (e.g. layers & curls)"],
  "locs-services": ["Starter locs / instant locs","Retwist / interlocking","Loc styling","Microlocs / sisterlocs","Loc extensions (permanent)","Loc wash / detox"],
  "faux-locs-services": ["Faux locs / soft locs","Boho locs","Crochet faux locs / invisible locs","Butterfly locs"],
  "sew-in-weave": ["Closure sew-in / closure behind the hairline","Flipover / Versatile sew-in","Frontal sew-in","Pixie wig / weave install","Quick weave","Sew-in take-down","Tracks (+ silk press) / partial / invisible sew-in","Traditional sew-in / leave out","Fulani sew-in / quick weave","Boho sew-in","Feed-in / stitch braid sew-in","Tape-ins + sew-in","K-tips + sew-in","Hair loss systems (e.g. mesh)","Extensions blow-dry / bouncy blowout","Extensions styling only (e.g. layers & curls)","Cassie braided sew-in","Jayda Wayda braided sew-in"],
  "styling-services": ["Frontal ponytail / bun","Half up half down","Sleek ponytail / bun","Updo","Braided ponytail"],
  "pixie-services": ["Pixie cut / finger waves","Barbering (women welcome)","Female barbers available"],
  "straightening-treatments": ["Bond repair","Cécred wash & treatment","Hair botox","Japanese straightening","K18 treatment","Keratin treatment / Brazilian blowdry","Moisturising treatment","Olaplex treatment","Protein treatment","Relaxer / texturiser","Texture release","Hot oil treatment"],
  "natural-hair-services": ["Wig cornrows","Curly cut / wash & go / diffuse","Silk press","Bouncy blowout / round brush blow dry","Trim / hair cut","Roller set","Twist out / flexi rod","Bantu knots","Wash & blowdry","Japanese head spa","Scalp detox / treatments","Men's braids","Natural twists / plaits"],
  "natural-hair-scalp-health": ["Healthy hair plans & consultations","Natural hair coaches / educators","Trichology / scalp analysis"],
  "wig-services": ["Wig customisation / construction","Pixie wig / weave install","U-Part / Half wig install","Wig colouring / bundle colouring","Wig install (frontal / closure)","Wig laundry / wig revamp","Wig blow-dry / bouncy blowout","Wig styling only (e.g. layers & curls)","Frontal / closure replacement","Wig reinstall / re-glue"],
};
export let categoryMap = defaultCategoryMap;

export function setCategoryMapCache(categories) {
  if (!Array.isArray(categories)) return;
  const next = {};
  for (const cat of categories) {
    const services = Array.isArray(cat?.subcategories) && cat.subcategories.length ? cat.subcategories : [cat?.label].filter(Boolean);
    if (cat?.id) next[cat.id] = services;
  }
  categoryMap = next;
}

(async () => {
  try {
    const raw = await fs.readFile(filtersPath, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.categories) && data.categories.length) {
      setCategoryMapCache(data.categories);
    }
  } catch {
    // keep default
  }
})();

export const serviceAliases = {
  "Cecred treatment": "Cécred wash & treatment",
  "Fulani sew-in": "Fulani sew-in / quick weave",
  "Cécred treatment": "Cécred wash & treatment",
  "Hybrid sew in (tapes + sew in)": "Tape-ins + sew-in",
  "K-18 treatment": "K18 treatment",
  "Bond repair treatment": "Bond repair",
  "Bond builder": "Bond repair",
  "Colour blend": "Colour blend (mixing braiding hair)",
  "Color blend": "Colour blend (mixing braiding hair)",
  "Colour mix": "Colour blend (mixing braiding hair)",
  "Color mix": "Colour blend (mixing braiding hair)",
  "Keratin treatment": "Keratin treatment / Brazilian blowdry",
  "U-part wig install": "U-Part / Half wig install",
  "Boho bob": "Boho braids bob",
  "Closure sew-in": "Closure sew-in / closure behind the hairline",
  "Curly cut / wash & go": "Curly cut / wash & go / diffuse",
  // Old names, kept so saved data and links from before the renames still resolve.
  "Sew in / extensions blowdry & styling": "Extensions blow-dry / bouncy blowout",
  "Wig blowdry & styling": "Wig blow-dry / bouncy blowout",
  "Custom wig": "Wig customisation / construction",
  "Custom wig / wig construction": "Wig customisation / construction",
  "Soft locs": "Faux locs / soft locs",
  "Cassie braids": "Cassie braided sew-in",
  "Jayda Wayda braids": "Jayda Wayda braided sew-in",
  "Fulani sew-in / quick weave / half wig": "Fulani sew-in / quick weave",
  "Zoe Kravitz braids": "Boho braids / goddess braids",
  "Custom made frontal unit": "Wig customisation / construction",
  "Custom made closure unit": "Wig customisation / construction",
  "Custom handmade wig": "Wig customisation / construction",
  "Custom handmade wigs": "Wig customisation / construction",
  "Custom Handmade Wig": "Wig customisation / construction",
  "Custom Handmade Wigs": "Wig customisation / construction",
  "Bespoke wig": "Wig customisation / construction",
  "Bespoke wigs": "Wig customisation / construction",
  "bespoke wig": "Wig customisation / construction",
  "bespoke wigs": "Wig customisation / construction",
  "Custom frontal unit": "Wig customisation / construction",
  "Custom closure unit": "Wig customisation / construction",
  "Customised closure unit": "Wig customisation / construction",
  "Customised Closure unit": "Wig customisation / construction",
  "Customised Closure Unit": "Wig customisation / construction",
  "Customized closure unit": "Wig customisation / construction",
  "Customized Closure Unit": "Wig customisation / construction",
  "Custom Mini Frontal Unit": "Wig customisation / construction",
  "Custom mini frontal unit": "Wig customisation / construction",
  "Custom frontal/closure units": "Wig customisation / construction",
  "Custom frontal / closure units": "Wig customisation / construction",
  "Custom frontal wig unit": "Wig customisation / construction",
  "Custom closure wig unit": "Wig customisation / construction",
  "Frontal unit": "Wig install (frontal / closure)",
  "Closure unit": "Wig install (frontal / closure)",
  "Wig making": "Wig customisation / construction",
  "wig making": "Wig customisation / construction",
  "Wig construction": "Wig customisation / construction",
  "Wig Customising": "Wig customisation / construction",
  "Wig customising": "Wig customisation / construction",
  "wig customising": "Wig customisation / construction",
  "Wig customisation": "Wig customisation / construction",
  "wig customisation": "Wig customisation / construction",
  "Wig customization": "Wig customisation / construction",
  "wig customization": "Wig customisation / construction",
  "Unit Customisation": "Wig customisation / construction",
  "Unit customisation": "Wig customisation / construction",
  "unit customisation": "Wig customisation / construction",
  "Unit Customization": "Wig customisation / construction",
  "Unit customization": "Wig customisation / construction",
  "unit customization": "Wig customisation / construction",
  "Construction and Customisation": "Wig customisation / construction",
  "Construction and Customization": "Wig customisation / construction",
  "construction and customisation": "Wig customisation / construction",
  "construction and customization": "Wig customisation / construction",
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
  "Closure sew-in": "Closure sew-in / closure behind the hairline",
  "Closure sew in": "Closure sew-in / closure behind the hairline",
  "closure sew-in": "Closure sew-in / closure behind the hairline",
  "closure sew in": "Closure sew-in / closure behind the hairline",
  "Closure- behind the hairline": "Closure sew-in / closure behind the hairline",
  "Closure behind the hairline": "Closure sew-in / closure behind the hairline",
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
  "Sew in / extensions blowdry": "Extensions blow-dry / bouncy blowout",
  "Wig blowdry": "Wig blow-dry / bouncy blowout",
  "Wig laundry": "Wig laundry / wig revamp",
  "Extensions / wig blowdry": "Extensions blow-dry / bouncy blowout",
  "Extensions blowdry": "Extensions blow-dry / bouncy blowout",
  "Extensions blowout": "Extensions blow-dry / bouncy blowout",
  "Extension blowdry": "Extensions blow-dry / bouncy blowout",
  "Extension blowout": "Extensions blow-dry / bouncy blowout",
  "Blowdry with extensions": "Extensions blow-dry / bouncy blowout",
  "Blow dry with extensions": "Extensions blow-dry / bouncy blowout",
  "Blowout with extensions": "Extensions blow-dry / bouncy blowout",
  "Weave blowdry": "Extensions blow-dry / bouncy blowout",
  "Weave blow dry": "Extensions blow-dry / bouncy blowout",
  "Weave blowout": "Extensions blow-dry / bouncy blowout",
  "Weave blow out": "Extensions blow-dry / bouncy blowout",
  "Sew in blowdry": "Extensions blow-dry / bouncy blowout",
  "Sew in blow dry": "Extensions blow-dry / bouncy blowout",
  "Sew-in blowdry": "Extensions blow-dry / bouncy blowout",
  "Sew-in blow dry": "Extensions blow-dry / bouncy blowout",
  "Sewin blowdry": "Extensions blow-dry / bouncy blowout",
  "Sewin blow dry": "Extensions blow-dry / bouncy blowout",
  "Sew in blowout": "Extensions blow-dry / bouncy blowout",
  "Sew in blow out": "Extensions blow-dry / bouncy blowout",
  "K tips blowdry": "Extensions blow-dry / bouncy blowout",
  "K-tips blowdry": "Extensions blow-dry / bouncy blowout",
  "Ktips blowdry": "Extensions blow-dry / bouncy blowout",
  "K tips blow dry": "Extensions blow-dry / bouncy blowout",
  "K-tips blow dry": "Extensions blow-dry / bouncy blowout",
  "Ktips blow dry": "Extensions blow-dry / bouncy blowout",
  "Blow out on sew in weave": "Extensions blow-dry / bouncy blowout",
  "Blowout on sew in weave": "Extensions blow-dry / bouncy blowout",
  "Wash and blowdry with extensions": "Extensions blow-dry / bouncy blowout",
  "Wash and blow dry with extensions": "Extensions blow-dry / bouncy blowout",
  "Wash & blowdry with extensions": "Extensions blow-dry / bouncy blowout",
  "Wash & Blow dry with Extensions": "Extensions blow-dry / bouncy blowout",
  "LA weave": "LA weave / microlinks wefts / braidless sew in",
  "Microlinks wefts": "LA weave / microlinks wefts / braidless sew in",
  "Micro links wefts": "LA weave / microlinks wefts / braidless sew in",
  "Braidless sew-in": "LA weave / microlinks wefts / braidless sew in",
  "Braidless sew in": "LA weave / microlinks wefts / braidless sew in",
  "Microlinks": "I-tips / microlinks strands",
  "I-tips": "I-tips / microlinks strands",
  "I tips": "I-tips / microlinks strands",
  "Microlinks strands": "I-tips / microlinks strands",
  "Micro links strands": "I-tips / microlinks strands",
  "Flipover sew-in": "Flipover / Versatile sew-in",
  "Flipover / versatile sew-in": "Flipover / Versatile sew-in",
  "Hybrid sew-in": "Tape-ins + sew-in",
  "Hybrid sew in": "Tape-ins + sew-in",
  "Bouncy blowout / Round Brush Blow dry": "Bouncy blowout / round brush blow dry",
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
  "Alicia Keys braids": "Alicia Keys braids",
  "Alicia keys braids": "Alicia Keys braids",
  "Tribal braids": "Fulani / lemonade braids",
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
  "K-tips / Invisible strands": "K-tips / invisible strands",
  "Keratin tip": "K-tips / invisible strands",
  "Keratin tips": "K-tips / invisible strands",
  "keratin tip": "K-tips / invisible strands",
  "keratin tips": "K-tips / invisible strands",
  "Wash & go": "Curly cut / wash & go / diffuse",
  "Wash & go / Curly cut": "Curly cut / wash & go / diffuse",
  "Curly cut / Wash & go": "Curly cut / wash & go / diffuse",
  "Curly cut": "Curly cut / wash & go / diffuse",
  "Wash and go": "Curly cut / wash & go / diffuse",
  "Curly cut / wash & go": "Curly cut / wash & go / diffuse",
  "Wash & blowdry / Blowout": "Wash & blowdry",
  "Washing / blow drying of hair": "Wash & blowdry",
  Blowout: "Wash & blowdry",
  "Extensions blowdry": "Extensions blow-dry / bouncy blowout",
  "Extensions blowout": "Extensions blow-dry / bouncy blowout",
  "Extension blowdry": "Extensions blow-dry / bouncy blowout",
  "Extension blowout": "Extensions blow-dry / bouncy blowout",
  "Blowdry with extensions": "Extensions blow-dry / bouncy blowout",
  "Blow dry with extensions": "Extensions blow-dry / bouncy blowout",
  "Blowout with extensions": "Extensions blow-dry / bouncy blowout",
  "Weave blowdry": "Extensions blow-dry / bouncy blowout",
  "Weave blow dry": "Extensions blow-dry / bouncy blowout",
  "Weave blowout": "Extensions blow-dry / bouncy blowout",
  "Weave blow out": "Extensions blow-dry / bouncy blowout",
  "Sew in blowdry": "Extensions blow-dry / bouncy blowout",
  "Sew in blow dry": "Extensions blow-dry / bouncy blowout",
  "Sew-in blowdry": "Extensions blow-dry / bouncy blowout",
  "Sew-in blow dry": "Extensions blow-dry / bouncy blowout",
  "Sewin blowdry": "Extensions blow-dry / bouncy blowout",
  "Sewin blow dry": "Extensions blow-dry / bouncy blowout",
  "Sew in blowout": "Extensions blow-dry / bouncy blowout",
  "Sew in blow out": "Extensions blow-dry / bouncy blowout",
  "K tips blowdry": "Extensions blow-dry / bouncy blowout",
  "K-tips blowdry": "Extensions blow-dry / bouncy blowout",
  "Ktips blowdry": "Extensions blow-dry / bouncy blowout",
  "K tips blow dry": "Extensions blow-dry / bouncy blowout",
  "K-tips blow dry": "Extensions blow-dry / bouncy blowout",
  "Ktips blow dry": "Extensions blow-dry / bouncy blowout",
  "Blow out on sew in weave": "Extensions blow-dry / bouncy blowout",
  "Blowout on sew in weave": "Extensions blow-dry / bouncy blowout",
  "Wash and blowdry with extensions": "Extensions blow-dry / bouncy blowout",
  "Wash and blow dry with extensions": "Extensions blow-dry / bouncy blowout",
  "Wash & blowdry with extensions": "Extensions blow-dry / bouncy blowout",
  "Wash & Blow dry with Extensions": "Extensions blow-dry / bouncy blowout",
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
  "U-Part wig install": "U-Part / Half wig install",
  "U Part Wig": "U-Part / Half wig install",
  "U-Part Wig": "U-Part / Half wig install",
  "U-Part wig": "U-Part / Half wig install",
  "U-part wig": "U-Part / Half wig install",
  "U-Part": "U-Part / Half wig install",
  "U-part": "U-Part / Half wig install",
  "u-part": "U-Part / Half wig install",
  Upart: "U-Part / Half wig install",
  upart: "U-Part / Half wig install",
  "U part": "U-Part / Half wig install",
  "u part": "U-Part / Half wig install",
  "Middle part U part": "U-Part / Half wig install",
  "Side part Upart": "U-Part / Half wig install",
  "Pixie wig install": "Pixie wig / weave install",
  "Pixie weave install": "Pixie wig / weave install",
  "PIXIE CUT WIG MAKING & STYLING": "Pixie wig / weave install",
  "Pixie cut": "Pixie cut / finger waves",
  "Pixie cut / wrap": "Pixie cut / finger waves",
  Wrap: "Pixie cut / finger waves",
  "Finger waves": "Pixie cut / finger waves",
  "Barber cuts / fades (women welcome)": "Barbering (women welcome)",
  "Barber cuts / fades": "Barbering (women welcome)",
  "Barber cut": "Barbering (women welcome)",
  "Barber cuts": "Barbering (women welcome)",
  "Buzz cut": "Barbering (women welcome)",
  "Buzz cuts": "Barbering (women welcome)",
  "Clipper cut": "Barbering (women welcome)",
  "Clipper cuts": "Barbering (women welcome)",
  "Skin fade": "Barbering (women welcome)",
  "Skin fades": "Barbering (women welcome)",
  "Shape up": "Barbering (women welcome)",
  "Female barber": "Female barbers available",
  "Lady barber": "Female barbers available",
  "Woman barber": "Female barbers available",
  Bridal: "Bridal",
  "Bridal hair": "Bridal",
  "Bridal styling": "Bridal",
  "Editorial styling": "Editorial / Session styling",
  Editorial: "Editorial / Session styling",
  "Session styling": "Editorial / Session styling",
  "Microlocs / Sisterlocs": "Microlocs / sisterlocs",
  "Invisible locs": "Crochet faux locs / invisible locs",
  "Invisible Locs": "Crochet faux locs / invisible locs",
  "Faux locs": "Faux locs / soft locs",
  "faux locs": "Faux locs / soft locs",
  "Crochet locs": "Crochet faux locs / invisible locs",
  "crochet locs": "Crochet faux locs / invisible locs",
  "Crochet faux locs": "Crochet faux locs / invisible locs",
  "Faux locs crochet": "Crochet faux locs / invisible locs",
  "Micro locs": "Microlocs / sisterlocs",
  Microlocs: "Microlocs / sisterlocs",
  Sisterlocs: "Microlocs / sisterlocs",
  "Starter locs": "Starter locs / instant locs",
  "Instant locs": "Starter locs / instant locs",
  Retwist: "Retwist / interlocking",
  Interlocking: "Retwist / interlocking",
  "Barrel twists / locs styling": "Loc styling",
  "Loc extensions": "Loc extensions (permanent)",
};

// Platforms whose listing/booking page has a customer reviews section we can
// reliably detect (server-rendered review count). None of these — including
// Google — formally verify the reviewer had a real appointment, so the UI
// deliberately doesn't claim "verified"; this is just "has reviews".
const verifiedReviewHostnames = ["fresha.com", "treatwell.co.uk", "booksy.com", "vagaro.com", "styleseat.com", "setmore.com"];

function hasVerifiedReviewPlatform(salon) {
  const url = (salon.bookingUrl || "").toLowerCase();
  return verifiedReviewHostnames.some((hostname) => url.includes(hostname));
}

// Being on a verified-review platform isn't enough on its own — a listing can be on
// Fresha with zero reviews yet. Only count it once we've actually confirmed a positive
// review count (see scripts/backfill-verified-review-counts.mjs). Unchecked salons
// (verifiedReviewCount undefined) are treated as not-yet-verified, not verified.
function hasVerifiedBookingPlatformReviews(salon) {
  return hasVerifiedReviewPlatform(salon) && Number(salon.verifiedReviewCount) > 0;
}

// Google fills the gap for salons with no booking-platform reviews. Only trust it
// when the match was high-confidence (see scripts/backfill-google-reviews.mjs) —
// a low-confidence match could be an entirely different business.
function hasVerifiedGoogleReviews(salon) {
  return salon.googleMatchConfidence === "high" && Number(salon.googleReviewCount) > 0;
}

function salonHasVerifiedReviews(salon) {
  return hasVerifiedBookingPlatformReviews(salon) || hasVerifiedGoogleReviews(salon);
}

const staleCheckThresholdMs = 90 * 24 * 60 * 60 * 1000;

// Fleet-wide review-data completeness, surfaced on /api/health so a gap (a
// backfill script that never got run, or a batch of no-match/low-confidence
// results) shows up passively instead of only being caught by someone eyeballing
// the directory, as happened before this was added.
export function computeReviewHealth(salons) {
  const now = Date.now();
  const health = { neverChecked: [], noMatch: [], lowConfidence: [], staleCheck: [] };

  for (const salon of salons) {
    if (!salon.googleCheckedAt) {
      health.neverChecked.push(salon.id);
      continue;
    }
    if (salon.googleMatchConfidence === "no-match") {
      health.noMatch.push(salon.id);
    } else if (salon.googleMatchConfidence === "low") {
      health.lowConfidence.push(salon.id);
    }
    const checkedAt = Date.parse(salon.googleCheckedAt);
    if (Number.isFinite(checkedAt) && now - checkedAt > staleCheckThresholdMs) {
      health.staleCheck.push(salon.id);
    }
  }

  return {
    neverCheckedCount: health.neverChecked.length,
    noMatchCount: health.noMatch.length,
    lowConfidenceCount: health.lowConfidence.length,
    staleCheckCount: health.staleCheck.length,
    neverChecked: health.neverChecked,
    noMatch: health.noMatch,
    lowConfidence: health.lowConfidence,
    staleCheck: health.staleCheck,
  };
}

// Multi-branch brands (e.g. Blue Tit) are stored as one parent record holding
// shared fields (services, Instagram, pricing) plus a `branches` array holding
// only what's genuinely branch-specific (location, booking link, Google match,
// wheelchair access). Search/filtering/rendering all operate on flat rows, so
// each branch is expanded here into its own row carrying the parent's shared
// fields — this is the only place that shape exists; everything downstream
// (search, the public site's brand grouping) sees the same flat rows it always
// has, tagged with brandId/brandName/branchLabel.
function flattenBrandedSalons(salons) {
  const flattened = [];
  for (const salon of salons) {
    if (Array.isArray(salon.branches) && salon.branches.length > 0) {
      const { branches, ...sharedFields } = salon;
      for (const branch of branches) {
        flattened.push({
          ...sharedFields,
          ...branch,
          id: `${salon.id}-${branch.id}`,
          brandId: salon.id,
          brandName: salon.name,
        });
      }
    } else {
      flattened.push(salon);
    }
  }
  return flattened;
}

export async function readSalonIndex() {
  const manualIndex = await readIndexFile(manualIndexPath, "manual");
  // adminNotes are private reminders for whoever edits manual-salons.json and
  // serviceProof/needsProof hold admin-only links/notes behind a service or
  // additional need; every other field is served publicly, so drop them here.
  const normalizedSalons = flattenBrandedSalons(manualIndex.salons)
    .map(({ adminNotes, serviceProof, needsProof, ...salon }, addedIndex) => ({
      ...salon,
      addedIndex,
      services: normalizeServices(salon.services),
      hasVerifiedReviews: salonHasVerifiedReviews(salon),
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
  wheelchairAccessible = false,
  senFriendly = false,
  lgbtqFriendly = false,
  parkingAvailable = false,
  sellingHairAny = false,
  priceIncludesHair = false,
  sellsHairSeparately = false,
  sameDayEmergency = false,
  hasVerifiedReviews = false,
  googleReviewsOnly = false,
  bookingSitesOnly = false,
  customFilters = {},
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
        matchesCanBraidWithoutGel(salon, canBraidWithoutGel) &&
        matchesWheelchairAccessible(salon, wheelchairAccessible) &&
        matchesSenFriendly(salon, senFriendly) &&
        matchesLgbtqFriendly(salon, lgbtqFriendly) &&
        matchesParkingAvailable(salon, parkingAvailable) &&
        matchesSellingHairAny(salon, sellingHairAny) &&
        matchesPriceIncludesHair(salon, priceIncludesHair) &&
        matchesSellsHairSeparately(salon, sellsHairSeparately) &&
        matchesSameDayEmergency(salon, sameDayEmergency) &&
        matchesHasVerifiedReviews(salon, hasVerifiedReviews) &&
        matchesGoogleReviewsOnly(salon, googleReviewsOnly) &&
        matchesBookingSitesOnly(salon, bookingSitesOnly) &&
        matchesCustomFilters(salon, customFilters),
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
  setSecurityHeaders(res);
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
  const selectedRegions = Array.isArray(regions) && regions.length > 0 ? regions : ["all"];

  if (selectedRegions.includes("all")) {
    return areaIds.length > 0;
  }

  return selectedRegions.some((region) => {
    const parentGroup = regionParentGroups.find((group) => group.parentId === region);
    if (parentGroup) {
      return areaIds.some((areaId) => areaId === region || parentGroup.childIds.includes(areaId));
    }

    if (region === "south-east" || region === "south-west") {
      return areaIds.includes(region) || areaIds.includes("south");
    }

    return areaIds.includes(region);
  });
}

// Parent filters are derived: a stylist tagged with a member (e.g. Tape-ins +
// sew-in) also matches its parent heading.
export const derivedServiceMatches = {
  // Sew in / weave's filter-only hybrid heading (see serviceFamilies in src/lib/serviceTaxonomy.ts).
  "Hybrid sew ins (all)": ["Boho sew-in", "Feed-in / stitch braid sew-in", "Fulani sew-in / quick weave", "K-tips + sew-in", "Tape-ins + sew-in", "Cassie braided sew-in", "Jayda Wayda braided sew-in"],
  // Extensions' filter-only hybrid heading: just the extension hybrids.
  "Hybrid installs (all)": ["K-tips + sew-in", "Tape-ins + sew-in"],
  // Wigs' filter-only install heading.
  "Wig installs (all)": ["Wig install (frontal / closure)", "U-Part / Half wig install", "Pixie wig / weave install"],
  // Braids' filter-only celebrity-inspired heading.
  "Celebrity-inspired braids (all)": ["Alicia Keys braids", "Pop smoke braids", "Jayda Wayda braided sew-in", "Cassie braided sew-in", "Coi Leray braids", "Tyla braids"],
  // Bond repair is also a real service (salons that don't name a brand), so it
  // matches its own tag as well as the named brands.
  "Bond repair": ["Olaplex treatment", "K18 treatment"],
  // A female barber is a more specific match within the women-welcome barber heading.
  "Barbering (women welcome)": ["Female barbers available"],
};

function hasService(services, service) {
  return services.includes(service) || (derivedServiceMatches[service] ?? []).some((child) => services.includes(child));
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

  return (subcategories ?? []).every((subcategory) => hasService(services, subcategory));
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

function matchesSenFriendly(salon, senFriendly) {
  if (!senFriendly) {
    return true;
  }

  return salon.senFriendly === true;
}

function matchesLgbtqFriendly(salon, lgbtqFriendly) {
  if (!lgbtqFriendly) {
    return true;
  }

  return salon.lgbtqFriendly === true;
}

function matchesParkingAvailable(salon, parkingAvailable) {
  if (!parkingAvailable) {
    return true;
  }

  return salon.parkingAvailable === true;
}

function matchesSellingHairAny(salon, sellingHairAny) {
  if (!sellingHairAny) {
    return true;
  }

  return salon.priceIncludesHair === true || salon.sellsHairSeparately === true;
}

function matchesPriceIncludesHair(salon, priceIncludesHair) {
  if (!priceIncludesHair) {
    return true;
  }

  return salon.priceIncludesHair === true;
}

function matchesSellsHairSeparately(salon, sellsHairSeparately) {
  if (!sellsHairSeparately) {
    return true;
  }

  return salon.sellsHairSeparately === true;
}

function matchesSameDayEmergency(salon, sameDayEmergency) {
  if (!sameDayEmergency) {
    return true;
  }

  return salon.sameDayEmergency === true;
}

function matchesWheelchairAccessible(salon, wheelchairAccessible) {
  if (!wheelchairAccessible) {
    return true;
  }

  return salon.wheelchairAccessible === true;
}

function matchesHasVerifiedReviews(salon, hasVerifiedReviews) {
  if (!hasVerifiedReviews) {
    return true;
  }

  return salonHasVerifiedReviews(salon) === true;
}

function matchesGoogleReviewsOnly(salon, googleReviewsOnly) {
  if (!googleReviewsOnly) {
    return true;
  }

  return hasVerifiedGoogleReviews(salon) === true;
}

function matchesBookingSitesOnly(salon, bookingSitesOnly) {
  if (!bookingSitesOnly) {
    return true;
  }

  return hasVerifiedBookingPlatformReviews(salon) === true;
}


function matchesCustomFilters(salon, customFilters) {
  if (!customFilters || typeof customFilters !== "object") {
    return true;
  }

  const selectedEntries = Object.entries(customFilters).filter(
    ([, values]) => Array.isArray(values) && values.length > 0,
  );

  if (selectedEntries.length === 0) {
    return true;
  }

  const salonCustomFilters = salon.customFilters && typeof salon.customFilters === "object" ? salon.customFilters : {};

  return selectedEntries.every(([filterTypeId, values]) => {
    const salonValues = Array.isArray(salonCustomFilters[filterTypeId]) ? salonCustomFilters[filterTypeId] : [];
    return values.every((value) => salonValues.includes(value));
  });
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
