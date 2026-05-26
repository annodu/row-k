import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { categoryMap, normalizeServices, serviceAliases } from "./salon-index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const draftsPath = path.resolve(__dirname, "../data/stylist-drafts.json");
const freshnessChecksPath = path.resolve(__dirname, "../data/freshness-checks.json");
const discoverySuggestionsPath = path.resolve(__dirname, "../data/discovery-suggestions.json");
const manualIndexPath = path.resolve(__dirname, "../data/manual-salons.json");
const sessionCookieName = "rowk_admin_session";
const sessionMaxAgeSeconds = 60 * 60 * 12;
const repositoryRoot = path.resolve(__dirname, "..");
const githubBackedJsonPaths = new Set(["data/manual-salons.json", "data/stylist-drafts.json", "data/discovery-suggestions.json"]);

const regionOptions = [
  { id: "all-london", label: "London" },
  { id: "central", label: "Central London" },
  { id: "north", label: "North London" },
  { id: "north-west", label: "North West London" },
  { id: "east", label: "East London" },
  { id: "south-east", label: "South East London" },
  { id: "south-west", label: "South West London" },
  { id: "west", label: "West London" },
  { id: "croydon", label: "Croydon" },
  { id: "kent", label: "Kent" },
  { id: "essex", label: "Essex" },
  { id: "mobile", label: "Mobile / Home service" },
];

const bookingPlatformMatchers = [
  ["fresha.com", "Fresha"],
  ["booksy.com", "Booksy"],
  ["setmore.com", "Setmore"],
  ["as.me", "Acuity"],
  ["acuityscheduling.com", "Acuity"],
  ["square.site", "Square"],
  ["squareup.com", "Square"],
  ["treatwell.co.uk", "Treatwell"],
  ["glossgenius.com", "GlossGenius"],
  ["styleseat.com", "StyleSeat"],
  ["calendly.com", "Calendly"],
];

const browserUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
let nextInstagramProfileProbeAt = 0;
const canonicalServices = [...new Set(Object.values(categoryMap).flat().filter(Boolean))].sort((left, right) => left.localeCompare(right));

const intakeServiceAliases = {
  "leave out weave": "Traditional sew-in / leave out",
  "leave-out weave": "Traditional sew-in / leave out",
  "leave out sew in": "Traditional sew-in / leave out",
  "leave-out sew-in": "Traditional sew-in / leave out",
  "middle part sewin": "Traditional sew-in / leave out",
  "middle part sew in": "Traditional sew-in / leave out",
  "middle part sew-in": "Traditional sew-in / leave out",
  "middle part weave": "Traditional sew-in / leave out",
  "side part sewin": "Traditional sew-in / leave out",
  "side part sew in": "Traditional sew-in / leave out",
  "side part sew-in": "Traditional sew-in / leave out",
  "side part weave": "Traditional sew-in / leave out",
  "traditional weave": "Traditional sew-in / leave out",
};

const serviceRuleMatchers = [
  ["Wig colour", [/\b(wig|extensions?|bundle|bundles|frontal|closure|lace\s+system)\b.*\b(colou?r|dye|ton(e|ing)|bleach|highlight|custom colou?r)\b/, /\b(colou?r|dye|ton(e|ing)|bleach|highlight|custom colou?r)\b.*\b(wig|extensions?|bundle|bundles|frontal|closure|lace\s+system)\b/, /\b613\b.*\b(colou?r|dye|ton(e|ing)|bleach|highlight|bright)\b/, /\b(colou?r|dye|ton(e|ing)|bleach|highlight|bright)\b.*\b613\b/, /\bnon[\s-]*contact\b.*\b(colou?r|colou?ring|dye|ton(e|ing)|bleach|highlight)\b/]],
  ["Frontal ponytail / bun", [/\bfrontal\b.*\b(pony|ponytail|bun)\b/, /\b(pony|ponytail|bun)\b.*\bfrontal\b/]],
  ["Half braids, half sew-in", [/\bhalf\b.*\b(braid|braids|feed\s*in|feed-in|cornrows?)\b.*\b(weave|sew[\s-]*in|sewin)\b/, /\bhalf\b.*\b(weave|sew[\s-]*in|sewin)\b.*\b(braid|braids|feed\s*in|feed-in|cornrows?)\b/, /\bhalf\s+braid\b/, /\bhalf\s+weave\b/]],
  ["Wig install (frontal / closure)", [/\bwig\b.*\b(install|instal|installation|application|fit|fitting)\b/, /\b(glueless|lace)\s+wig\b/, /\bfrontal\s+wig\b/, /\bclosure\s+wig\b/, /\b(frontal|closure|ready[\s-]*made)\s+unit\b/, /\bunit\b.*\b(install|instal|installation|application|fit|fitting)\b/, /\b(lace\s+)?frontal\s+installation\b/, /\b(lace\s+)?closure\s+installation\b/]],
  ["U-Part wig install", [/\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b.*\b(wig|install|installation)\b/, /\b(wig|install|installation)\b.*\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b/]],
  ["Custom wig", [/\bcustom\b.*\bwig\b/, /\bbespoke\b.*\bwig\b/, /\bcustom\s+handmade\s+wigs?\b/, /\bwig\b.*\b(custom|bespoke|handmade|made|making|construction|unit)\b/, /\bunit\b.*\bcustomi[sz](ing|ation)\b/, /\bcustomi[sz](ing|ation)\b.*\bunit\b/, /\bcustom(?:\s+made)?\b.*\b(frontal|closure)\s+unit\b/, /\bcustom\b.*\bfrontal\s+closure\s+units?\b/, /\bwig\s+(making|construction|customi[sz](ing|ation))\b/, /\bconstruction\s+of\s+(the\s+)?wig\b/, /\bconstruction\b.*\bcustomi[sz](ing|ation)\b/, /\bcustomi[sz](ing|ation)\b.*\bconstruction\b/, /\b(frontal|closure)\b.*\bcustomi[sz](ing|ation)\b/]],
  ["Pixie wig / weave install", [/\bpixie\b.*\b(wig|weave|sew\s*in|sewin|install|making)\b/, /\b(wig|weave|sew\s*in|sewin|making)\b.*\bpixie\b/]],
  ["Closure sew-in", [/\bclosure\b.*\b(sew\s*in|sewin|weave)\b/, /\b(sew\s*in|sewin|weave)\b.*\bclosure\b/, /\bweave\b.*\b(lace\s+)?closure\b/, /\bclosure\b.*\bbehind\s+the\s+hairline\b/]],
  ["Frontal sew-in", [/\bfrontal\b.*\b(sew\s*in|sewin|weave)\b/, /\b(sew\s*in|sewin|weave)\b.*\bfrontal\b/]],
  ["Flipover / Versatile sew-in", [/\bflip\s*over\b/, /\bflipover\b/, /\bversatile\b.*\b(sew\s*in|sewin|weave)\b/, /\bversatile\s+sew\s+in\b/]],
  ["Quick weave", [/\bquick\b.*\bweave\b/, /\bquickweave\b/]],
  ["Hybrid sew-in", [/\bhybrid\b.*\b(sew\s*in|sewin|weave)\b/, /\btracks?\b.*\btapes?\b.*\bhybrid\b/, /\bhybrid\b.*\btracks?\b.*\btapes?\b/]],
  ["Sew-in take-down", [/\b(sew\s*in|sewin|weave|tracks?)\b.*\b(take\s*down|takedown|removal|remove)\b/, /\b(take\s*down|takedown|removal|remove)\b.*\b(sew\s*in|sewin|weave|tracks?)\b/]],
  ["Tracks (+ Silk press) / Partial / Invisible sew-in", [/\btracks?\b/, /\bsingle\s+tracks?\s+weave\b/, /\bsingle\s*\/\s*double\s+tracks?\s+weave\b/, /\bindividual\s+sewn\s+on\s+tracks?\b/, /\bpartial\b.*\b(sew\s*in|sewin|weave)\b/, /\binvisible\b.*\b(sew\s*in|sewin|weave|wefts?)\b/, /\b(row|rows|line)\s+(?:of\s+)?(sew\s*in|sewin|weave)\b/, /\b(sew\s*in|sewin|weave)\s+(row|rows|line)\b/, /\bweave\s+on\s+per\s+row\b/, /\bweave\s+tracks?\s*\(?per\s+track\)?\b/, /\bsew[\s-]*in\s+tracks?\b/, /\bper\s+(track|row|line)\b/, /\btrack\s+per\s+row\b/, /\btracks?\s+per\s+(track|row|line|double\s+row)\b/, /\btraditional\s+weave\s+rows?\b/, /^\d+\s+row$/, /\bone\s+row\b/]],
  ["Traditional sew-in / leave out", [/\bleave\s*out\b/, /\b(middle|side)\s+part\b.*\b(sew\s*in|sewin|weave)\b/, /\btraditional\b.*\b(sew\s*in|sewin|weave)\b/, /\b(sew\s*in|sewin)\b/]],
  ["K-tips / Invisible strands", [/\bk\s*tips?\b/, /\bk-tips?\b/, /\binvisible\s+strands?\b/, /\bkeratin\s+(tips?|bonds?|extensions?)\b/]],
  ["LA weave", [/\bla\s+weave\b/]],
  ["Tape ins", [/\btape\s*ins?\b/, /\btape-in\b/, /\btapes?\b/, /\btape\s+extensions?\b/]],
  ["Microlinks", [/\bmicro\s*links?\b/, /\bmicrolinks?\b/, /\bi\s*tips?\b/, /\bitips?\b/]],
  ["Clip ins (+ Silk press)", [/\bclip\s*ins?\b/, /\bclip-in\b/]],
  ["Boho braids / goddess braids", [/\bboho\b/, /\bgoddess\b/]],
  ["Knotless braids", [/\bknotless\b/]],
  ["Box braids", [/\bbox\b.*\bbraids?\b/]],
  ["Crochet", [/\bcrochet\b/]],
  ["Creative braids (e.g. patewo)", [/\bpatewo\b/, /\bdolly\s+braids?\b/, /\bshuku\b/, /\bkoroba\s+braids?\b/, /\bcreative\b.*\bbraids?\b/]],
  ["Feed-in braids", [/\bfeed\s*in\b/, /\bfeed-in\b/, /\ball\s+back\b.*\b(braids?|cornrows?|feed\s*ins?)\b/, /\b(braids?|cornrows?|feed\s*ins?)\b.*\ball\s+back\b/, /\bbraids?\b.*\bgoing\s+back\b/, /\bgoing\s+back\b.*\bbraids?\b/, /\bcornrows?\b.*\b(extension|extensions|pre\s*pull(ed)?|braiding\s+hair)\b/, /\b(extension|extensions|pre\s*pull(ed)?|braiding\s+hair)\b.*\bcornrows?\b/]],
  ["French curl", [/\bfrench\s+curl\b/]],
  ["Fulani / Lemonade braids", [/\bfulani\b/, /\blemonade\b/, /\balicia\s+keys?\s+braids?\b/]],
  ["Miracle knots", [/\bmiracle\s+knots?\b/]],
  ["Microbraids / x-small braids", [/\bmicro\s*braids?\b/, /\bmicrobraids?\b/, /\bx\s*small\b.*\bbraids?\b/, /\bxs\b.*\bbraids?\b/]],
  ["Pre-parting", [/\bpre\s*part(ing)?\b/, /\bpre-part(ing)?\b/]],
  ["Stitch braids", [/\bstitch\b/]],
  ["Twists (with extensions)", [/\btwists?\b.*\b(extension|extensions|hair added)\b/, /\b(extension|extensions|hair added)\b.*\btwists?\b/, /\b(passion|marley|senegalese|island|kinky|rope)\s+twists?\b/, /\blarge\s+twists?\b/]],
  ["Braid take-down", [/\bbraids?\b.*\b(take\s*down|takedown|removal|remove)\b/, /\b(take\s*down|takedown|removal|remove)\b.*\bbraids?\b/]],
  ["Starter locs", [/\bstarter\s+locs?\b/, /\bstart\s+locs?\b/, /\bloc\s+start\b/]],
  ["Retwist", [/\bretwist\b/, /\bre\s*twist\b/]],
  ["Faux locs", [/\bfaux\s+locs?\b/, /\binvisible\s+locs?\b/, /\bsoft\s+locs?\b/]],
  ["Butterfly locs", [/\bbutterfly\s+locs?\b/]],
  ["Microlocs / Sisterlocs", [/\bmicro\s*locs?\b/, /\bmicrolocs?\b/, /\bsister\s*locs?\b/, /\bsisterlocs?\b/]],
  ["Balayage", [/\bbalayage\b/]],
  ["Highlights", [/\bhigh\s*lights?\b/, /\bhighlights?\b/]],
  ["Full head colour", [/\bfull\s+head\b.*\bcolou?r\b/, /\bpermanent\s+(colou?r|tint)\b/, /\b(colou?r|dye|tint)\b/]],
  ["Bridal / Editorial", [/\bbridal\b/, /\bwedding\b/, /\beditorial\b/, /\bsession\s+styling\b/, /\bphotoshoot\b/]],
  ["Keratin treatment", [/\bkeratin\b/]],
  ["Relaxer / texturiser", [/\brelaxer\b/, /\btexturi[sz]er\b/, /\btexturi[sz]ing\b/]],
  ["Texture release", [/\btexture\s+release\b/]],
  ["Japanese straightening", [/\bjapanese\b.*\bstraight(en|ening)\b/]],
  ["Hair Botox", [/\bbotox\b/]],
  ["Olaplex treatment", [/\bolaplex\b/, /\b(repair|bond)\b.*\b(bond|repair|treatment)\b/]],
  ["K-18 treatment", [/\bk\s*18\b/, /\bk-18\b/]],
  ["Moisturising treatment", [/\bmoisturi[sz](ing|e)\b/, /\bmoisture\b/, /\bhydrat(e|ing|ion)\b/, /\bprotein\s*&?\s+moisture\b/, /\bdeep\s+condition(ing)?\b/, /\bsteam\s+treat(ment)?\b/, /\bnatural\s+hair\s+care\b/]],
  ["Scalp care", [/\bscalp\b/]],
  ["Curly cut / Wash & go", [/\bcurly\s+cut\b/, /\bwash\s*(and|&)?\s*go\b/]],
  ["Wash & blowdry", [/\bwash\b.*\b(blow\s*dry|blowdry|blowout)\b/, /\bshampoo\b.*\b(blow\s*dry|blowdry|blowout)\b/, /\bblow\s*out\b/, /\bblowout\b/]],
  ["Trim / Hair cut", [/\btrim\b/, /\bhair\s*cut\b/, /\bhaircut\b/, /\bcut\s+and\s+finish\b/]],
  ["Silk press", [/\bsilk\s+press\b/, /\bsilkpress\b/, /\bpress\s+and\s+curl\b/]],
  ["Twist out / Flexi rod", [/\btwist\s*out\b/, /\bflexi\s*rod\b/, /\bflexi-rod\b/, /\bperm\s+rod\b/]],
  ["Wig cornrows", [/\bunder\s*wig\b/, /\bwig\s+(cornrows?|cainrows?)\b/, /\b(cornrows?|cainrows?)\s+for\s+wig\s+installation\b/, /\b(cornrows?|cainrows?)\s+without\s+extensions?\b/, /\bwig\s+cainrows?\b/, /\bcainrows?\b/, /\bcornrows?\b/]],
  ["Natural hair education", [/\b(afro|natural|curly|curl|hair)\b.*\beducation\b/, /\beducation\b.*\b(afro|natural|curly|curl|hair)\b/, /\b(hair|curl|styling)\b.*\btutorial\b/, /\btutorial\b.*\b(hair|curl|styling)\b/, /\btrichology\b/, /\bhair\s+health\b.*\b(assessment|plan|growth|consultation)\b/, /\bgrowth\s+plan\b/, /\bconsultation\b.*\bnatural\b/, /\bnatural\s+hair\b.*\b(class|education|consultation)\b/, /\bcurl\s+makeover\b.*\b(hands?\s*on|tutorial|styling)\b/]],
  ["Sleek ponytail / bun", [/\bsleek\b.*\b(pony|ponytail|bun)\b/, /\bpony\s*tail\b/, /\bponytail\b/, /\bbun\b/]],
  ["Half up half down", [/\bhalf\s+up\b.*\bhalf\s+down\b/, /\bhalf\s+up\s+half\s+down\b/, /\bhalf\s+up\s+half\s+down\b.*\b(quick\s+weave|sew\s+in|sewin|weave)\b/]],
  ["Pixie / finger waves", [/\bfinger\s+waves?\b/, /\bpixie\b/, /\bwrap\b/]],
  ["Updo", [/\bup\s*do\b/, /\bupdo\b/, /\bpin\s*up\b/, /\bfrench\s+roll\s+up\b/, /\bfrench\s+roll\b/]],
];

const serviceNegationHints = {
  "Balayage": ["balayage"],
  "Boho braids / goddess braids": ["boho", "goddess"],
  "Box braids": ["box braids"],
  "Braid take-down": ["braid take down", "braid takedown", "braid removal", "remove braids"],
  "Bridal / Editorial": ["bridal", "wedding", "editorial", "photoshoot"],
  "Butterfly locs": ["butterfly locs"],
  "Clip ins (+ Silk press)": ["clip ins", "clip in"],
  "Closure sew-in": ["closure sew in", "closure sew-in", "closure sewin", "closure weave", "weave with lace closure", "closure behind the hairline"],
  "Creative braids (e.g. patewo)": ["creative braids", "patewo", "dolly braids", "shuku", "koroba braids"],
  "Crochet": ["crochet"],
  "Curly cut / Wash & go": ["curly cut", "wash go", "wash and go"],
  "Custom wig": ["custom wig", "bespoke wig", "custom handmade wig", "custom handmade wigs", "custom made frontal unit", "custom made closure unit", "customised closure unit", "customized closure unit", "custom mini frontal unit", "unit customisation", "unit customization", "wig making", "wig construction", "construction of wig", "construction of the wig", "wig customising", "wig customisation", "wig customization", "construction and customisation", "construction and customization"],
  "Faux locs": ["faux locs", "soft locs"],
  "Feed-in braids": ["feed in", "feed in braids", "all back", "braids going back", "cornrows incl extensions", "cornrows including extensions", "cornrows with extensions", "20 cornrows"],
  "Flipover / Versatile sew-in": ["flipover", "flip over", "versatile sew in", "versatile sewin", "versatile weave"],
  "French curl": ["french curl"],
  "Frontal ponytail / bun": ["frontal ponytail", "frontal pony", "frontal bun"],
  "Frontal sew-in": ["frontal sew in", "frontal sewin", "frontal weave"],
  "Fulani / Lemonade braids": ["fulani", "lemonade", "alicia keys braids"],
  "Full head colour": ["full head colour", "full head color", "colour", "color", "dye", "tint"],
  "Hair Botox": ["hair botox", "botox"],
  "Half braids, half sew-in": ["half braids half sew in", "half braid half weave", "half weave"],
  "Half up half down": ["half up half down"],
  "Highlights": ["highlights", "high lights"],
  "Hybrid sew-in": ["hybrid sew in", "hybrid sewin", "hybrid weave"],
  "Japanese straightening": ["japanese straightening"],
  "K-18 treatment": ["k 18", "k18"],
  "K-tips / Invisible strands": ["k tips", "invisible strands", "keratin tip", "keratin tips", "keratin bonds"],
  "Keratin treatment": ["keratin"],
  "Knotless braids": ["knotless"],
  "LA weave": ["la weave"],
  "Microbraids / x-small braids": ["micro braids", "microbraids", "x small braids", "xs braids"],
  "Microlinks": ["micro links", "microlinks", "i tips", "itips"],
  "Microlocs / Sisterlocs": ["micro locs", "microlocs", "sister locs", "sisterlocs"],
  "Miracle knots": ["miracle knots"],
  "Moisturising treatment": ["moisturising", "moisturizing", "deep condition", "steam treatment", "natural hair care"],
  "Natural hair education": ["natural hair education", "natural hair class", "natural hair consultation"],
  "Olaplex treatment": ["olaplex"],
  "Pixie / finger waves": ["pixie", "finger waves"],
  "Pixie wig / weave install": ["pixie wig", "pixie weave", "pixie install", "pixie cut wig making", "pixie cut wig making styling"],
  "Pre-parting": ["pre parting", "pre part"],
  "Quick weave": ["quick weave", "quickweave"],
  "Relaxer / texturiser": ["relaxer", "texturiser", "texturizer", "texturising", "texturizing"],
  "Retwist": ["retwist", "re twist"],
  "Scalp care": ["scalp"],
  "Sew-in take-down": ["sew in take down", "sew in takedown", "sew in removal", "weave removal", "remove sew in"],
  "Silk press": ["silk press", "silkpress", "press and curl"],
  "Sleek ponytail / bun": ["sleek ponytail", "sleek pony", "sleek bun", "ponytail", "pony tail"],
  "Starter locs": ["starter locs", "start locs", "loc start"],
  "Stitch braids": ["stitch"],
  "Tape ins": ["tape ins", "tape in", "tapes", "tape extensions"],
  "Texture release": ["texture release"],
  "Tracks (+ Silk press) / Partial / Invisible sew-in": ["tracks", "track per row", "per track", "per row", "one row", "individual sewn on track", "individual sewn on tracks", "tracks add on", "tracks add-on", "silk press add on tracks", "silk press add-on tracks", "sew in tracks", "sew-in tracks", "sew-in tracks per line", "row sew in", "rows of sew in", "weave tracks", "weave tracks per track", "weave on per row", "single track weave", "single double track weave", "traditional weave rows", "partial sew in", "partial sewin", "invisible sew in", "invisible weave", "invisible weft", "invisible wefts"],
  "Traditional sew-in / leave out": ["leave out", "traditional sew in", "traditional sewin", "traditional weave", "sew in", "sewin"],
  "Trim / Hair cut": ["trim", "hair cut", "haircut", "cut and finish"],
  "Twist out / Flexi rod": ["twist out", "flexi rod", "perm rod"],
  "Twists (with extensions)": ["twists with extensions", "passion twists", "marley twists", "senegalese twists", "kinky twists", "rope twists", "island twists", "island twist", "large twist", "large twists"],
  "U-Part wig install": ["u part", "u-part", "upart", "u part wig", "u-part wig", "upart wig", "v part", "v-part", "vpart", "v part wig", "v-part wig", "vpart wig", "u vpart", "uvpart", "half wig"],
  "Updo": ["updo", "up do", "pin up", "french roll up", "french roll"],
  "Wash & blowdry": ["wash blowdry", "wash blow dry", "wash and blowdry", "wash and blow dry", "washing blow drying", "washing and blow drying", "shampoo blowdry", "shampoo blow dry", "shampoo and blowdry", "shampoo and blow dry", "blowout"],
  "Wig colour": ["wig colour", "wig color", "wig dye", "colour wig", "color wig", "wig colouring service", "hair bundle colouring service", "lace closure colouring", "lace frontal colouring", "highlights frontal bundles", "highlights bundles closure"],
  "Wig cornrows": ["under wig", "wig cornrows", "wig cainrows", "cainrows for wig installation", "cornrows for wig installation", "cornrows without extensions", "cainrows"],
  "Wig install (frontal / closure)": ["wig install", "wig installs", "wig instal", "wig installation", "wig application", "wig fitting", "glueless wig", "lace wig", "frontal wig", "closure wig", "wig frontal install", "wig closure install", "lace frontal installation", "lace closure installation", "frontal unit", "closure unit", "ready-made unit", "ready made unit", "unit install", "frontal unit install", "closure unit install"],
};

export function registerAdminStylistRoutes(app) {
  app.post("/api/admin/login", async (req, res) => {
    const configuredPassword = getAdminPassword();
    if (!configuredPassword) {
      return res.status(503).json({ ok: false, message: "Set ADMIN_PASSWORD before using the admin tool." });
    }

    if (String(req.body?.password || "").trim() !== configuredPassword) {
      return res.status(401).json({ ok: false, message: "That password was not accepted." });
    }

    res.setHeader("Set-Cookie", makeCookie(createSessionToken()));
    res.json({ ok: true });
  });

  app.post("/api/admin/logout", requireAdmin, async (_req, res) => {
    res.setHeader("Set-Cookie", expireCookie());
    res.json({ ok: true });
  });

  app.get("/api/admin/session", requireAdmin, async (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/admin/stylists/options", requireAdmin, async (_req, res) => {
    res.json({
      ok: true,
      regions: regionOptions,
      services: canonicalServices,
      aliases: Object.keys(serviceAliases).sort((left, right) => left.localeCompare(right)),
    });
  });

  app.get("/api/admin/stylists/drafts", requireAdmin, async (_req, res) => {
    const store = await readDraftStore();
    res.json({ ok: true, drafts: store.drafts, meta: store.meta });
  });

  app.get("/api/admin/stylists/published", requireAdmin, async (_req, res) => {
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual", updatedAt: null }, salons: [] });
    const updatedAt = manualIndex.meta?.updatedAt || new Date().toISOString();
    const stylists = (manualIndex.salons || []).map((salon) => publishedSalonToDraft(salon, updatedAt));

    res.json({ ok: true, stylists, meta: manualIndex.meta || null });
  });

  app.patch("/api/admin/stylists/published/:id", requireAdmin, async (req, res) => {
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const salonIndex = manualIndex.salons.findIndex((salon) => salon.id === req.params.id);
    if (salonIndex === -1) {
      return res.status(404).json({ ok: false, message: "Published stylist not found." });
    }

    const currentSalon = manualIndex.salons[salonIndex];
    const update = sanitizeDraftUpdate(req.body || {});
    const now = new Date().toISOString();
    const areaIds = normalizeAreaIds(update.areaIds?.length ? update.areaIds : update.areaId ? [update.areaId] : []);
    const areaLabel = update.areaLabel || areaLabelForIds(areaIds);
    const nextSalon = {
      ...currentSalon,
      name: update.name || currentSalon.name || "",
      areaId: areaIds[0] || update.areaId || currentSalon.areaId || "",
      ...(areaIds.length > 1 ? { areaIds } : { areaIds: undefined }),
      areaLabel: areaLabel || currentSalon.areaLabel || "",
      neighbourhood: update.neighbourhood || areaLabel || currentSalon.neighbourhood || "",
      postcode: update.postcode || "",
      bookingPlatform: update.bookingPlatform || platformFromUrl(update.bookingUrl) || currentSalon.bookingPlatform || "Direct",
      bookingUrl: update.bookingUrl || "",
      websiteUrl: update.websiteUrl || "",
      instagramUrl: update.instagramUrl || "",
      tiktokUrl: update.tiktokUrl || "",
      services: normalizeServices(update.services || []),
      hijabiFriendly: update.hijabiFriendly === true,
      canBraidWithoutGel: update.canBraidWithoutGel === true,
      summary: update.summary || currentSalon.summary || "",
      evidence: update.evidence?.length ? update.evidence : currentSalon.evidence || [],
      updatedAt: now,
    };

    if (!nextSalon.areaIds) {
      delete nextSalon.areaIds;
    }

    manualIndex.salons[salonIndex] = nextSalon;
    manualIndex.meta = {
      ...manualIndex.meta,
      updatedAt: now,
      count: manualIndex.salons.length,
    };
    await writeJson(manualIndexPath, manualIndex);

    res.json({ ok: true, stylist: publishedSalonToDraft(nextSalon, manualIndex.meta.updatedAt) });
  });

  app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
    const draftStore = await readDraftStore();
    const freshnessStore = await readFreshnessStore({ meta: { updatedAt: null, checkedCount: 0, total: 0 }, checks: [] });
    const discoveryStore = await readDiscoveryStore();
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual", count: 0 }, salons: [] });
    const drafts = draftStore.drafts;
    const freshnessChecks = freshnessStore.checks || [];
    const suggestions = discoveryStore.suggestions;

    res.json({
      ok: true,
      drafts: {
        total: drafts.length,
        needsReview: drafts.filter((draft) => draft.status === "needs_review").length,
        readyToApprove: drafts.filter((draft) => draft.status === "ready_to_approve").length,
        missingLocation: drafts.filter((draft) => !draft.areaId).length,
        missingServices: drafts.filter((draft) => !draft.services?.length).length,
      },
      freshness: {
        totalIssues: freshnessChecks.length,
        checkedCount: freshnessStore.meta?.checkedCount ?? 0,
        total: manualIndex.salons?.length ?? freshnessStore.meta?.total ?? 0,
        brokenLinks: freshnessChecks.filter((check) => check.linkChecks?.some(isActionableBrokenLink)).length,
        manualLinks: freshnessChecks.filter((check) => check.linkChecks?.some(isManualCheckLink)).length,
        serviceChanges: freshnessChecks.filter((check) => check.addedServices?.length || check.removedServices?.length).length,
        updatedAt: freshnessStore.meta?.updatedAt ?? null,
      },
      discovery: {
        total: suggestions.length,
        highConfidence: suggestions.filter((suggestion) => suggestion.confidence === "high").length,
        needsReview: suggestions.filter((suggestion) => suggestion.status === "suggested").length,
      },
    });
  });

  app.get("/api/admin/stylists/checks/saved", requireAdmin, async (_req, res) => {
    const store = await readFreshnessStore({ meta: { source: "freshness-checks", updatedAt: null, count: 0, checkedCount: 0, total: 0 }, checks: [] });
    res.json({
      ok: true,
      checks: store.checks || [],
      checkedAt: store.meta?.updatedAt ?? null,
      checkedCount: store.meta?.checkedCount ?? 0,
      total: store.meta?.total ?? 0,
      nextOffset: typeof store.meta?.checkedCount === "number" && typeof store.meta?.total === "number" && store.meta.checkedCount < store.meta.total ? store.meta.checkedCount : null,
      meta: store.meta || null,
    });
  });

  app.post("/api/admin/stylists/checks/saved", requireAdmin, async (req, res) => {
    const existingStore = await readFreshnessStore({ meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [], dismissedRecommendations: {} });
    const checkedAt = cleanString(req.body?.checkedAt) || new Date().toISOString();
    const checks = (Array.isArray(req.body?.checks) ? req.body.checks : [])
      .map((check) => sanitizeFreshnessCheck(check, check?.id))
      .filter(Boolean);
    const payload = {
      meta: {
        source: "freshness-checks",
        updatedAt: checkedAt,
        count: checks.length,
        checkedCount: Number(req.body?.checkedCount) || 0,
        total: Number(req.body?.total) || 0,
      },
      dismissedRecommendations: existingStore.dismissedRecommendations || {},
      checks,
    };
    await writeFreshnessStore(payload);
    res.json({ ok: true, ...payload.meta, checkedAt, checks });
  });

  app.get("/api/admin/stylists/checks", requireAdmin, async (req, res) => {
    const index = await readAdminSalonIndex();
    const checkedAt = new Date().toISOString();
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 50);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const batchSalons = index.salons.slice(offset, offset + limit);
    const existingStore = await readFreshnessStore({ meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [], dismissedRecommendations: {} });
    const dismissedRecommendations = existingStore.dismissedRecommendations || {};
    const existingChecksById = new Map((existingStore.checks || []).map((check) => [check.id, check]));
    const checks = await mapWithConcurrency(batchSalons, isHostedRuntime() ? 2 : 6, (salon) => checkSalonFreshness(salon, dismissedRecommendations[salon.id], existingChecksById.get(salon.id)), {
      delayMs: isHostedRuntime() ? 350 : 0,
    });
    const reviewChecks = checks.filter(
      (check) => check.issues.length > 0 || check.addedServices.length > 0 || check.removedServices.length > 0 || check.linkChecks?.some(isManualCheckLink),
    );
    const mergedChecks = offset > 0 ? mergeFreshnessChecks(existingStore.checks || [], reviewChecks) : reviewChecks;

    const checkedCount = Math.min(offset + batchSalons.length, index.salons.length);
    const persisted = await tryWriteJson(freshnessChecksPath, {
      meta: {
        source: "freshness-checks",
        updatedAt: checkedAt,
        count: mergedChecks.length,
        checkedCount,
        total: index.salons.length,
      },
      dismissedRecommendations,
      checks: mergedChecks,
    });

    res.json({
      ok: true,
      checks: reviewChecks,
      checkedAt,
      offset,
      limit,
      batchCount: batchSalons.length,
      checkedCount,
      total: index.salons.length,
      nextOffset: offset + batchSalons.length < index.salons.length ? offset + batchSalons.length : null,
      persisted,
    });
  });

  app.post("/api/admin/stylists/match-services", requireAdmin, async (req, res) => {
    const rawServices = toArray(req.body?.rawServices);
    res.json({ ok: true, services: matchServices(rawServices) });
  });

  app.patch("/api/admin/stylists/:id/freshness", requireAdmin, async (req, res) => {
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const salonIndex = manualIndex.salons.findIndex((salon) => salon.id === req.params.id);
    if (salonIndex === -1) {
      return res.status(404).json({ ok: false, message: "Salon not found." });
    }

    const salon = manualIndex.salons[salonIndex];
    const addServices = normalizeServices(toArray(req.body?.addServices));
    const removeServices = normalizeServices(toArray(req.body?.removeServices));
    const rejectAddedServices = normalizeServices(toArray(req.body?.rejectAddedServices));
    const rejectRemovedServices = normalizeServices(toArray(req.body?.rejectRemovedServices));
    const currentServices = normalizeServices(salon.services || []);
    const nextServices = currentServices.filter((service) => !removeServices.includes(service));
    addServices.forEach((service) => {
      if (!nextServices.includes(service)) {
        nextServices.push(service);
      }
    });

    manualIndex.salons[salonIndex] = {
      ...salon,
      ...(typeof req.body?.bookingUrl === "string" ? { bookingUrl: cleanString(req.body.bookingUrl) } : {}),
      ...(typeof req.body?.instagramUrl === "string" ? { instagramUrl: cleanString(req.body.instagramUrl) } : {}),
      ...(typeof req.body?.websiteUrl === "string" ? { websiteUrl: cleanString(req.body.websiteUrl) } : {}),
      services: nextServices,
    };
    manualIndex.meta = {
      ...manualIndex.meta,
      updatedAt: new Date().toISOString(),
      count: manualIndex.salons.length,
    };
    if (
      addServices.length ||
      removeServices.length ||
      typeof req.body?.bookingUrl === "string" ||
      typeof req.body?.instagramUrl === "string" ||
      typeof req.body?.websiteUrl === "string"
    ) {
      await writeJson(manualIndexPath, manualIndex);
    }

    await updateFreshnessReview(req.params.id, {
      addServices,
      removeServices,
      rejectAddedServices,
      rejectRemovedServices,
      bookingUrl: typeof req.body?.bookingUrl === "string" ? cleanString(req.body.bookingUrl) : undefined,
      instagramUrl: typeof req.body?.instagramUrl === "string" ? cleanString(req.body.instagramUrl) : undefined,
      websiteUrl: typeof req.body?.websiteUrl === "string" ? cleanString(req.body.websiteUrl) : undefined,
    });

    res.json({ ok: true, salon: manualIndex.salons[salonIndex] });
  });

  app.patch("/api/admin/stylists/:id/freshness/undo", requireAdmin, async (req, res) => {
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const salonIndex = manualIndex.salons.findIndex((salon) => salon.id === req.params.id);
    if (salonIndex === -1) {
      return res.status(404).json({ ok: false, message: "Salon not found." });
    }

    const previousServices = normalizeServices(toArray(req.body?.previousServices));
    if (previousServices.length) {
      manualIndex.salons[salonIndex] = {
        ...manualIndex.salons[salonIndex],
        services: previousServices,
      };
      manualIndex.meta = {
        ...manualIndex.meta,
        updatedAt: new Date().toISOString(),
        count: manualIndex.salons.length,
      };
      await writeJson(manualIndexPath, manualIndex);
    }

    const restoredCheck = await undoFreshnessReview(req.params.id, {
      check: req.body?.check,
      rejectAddedServices: toArray(req.body?.rejectAddedServices),
      rejectRemovedServices: toArray(req.body?.rejectRemovedServices),
    });

    res.json({ ok: true, salon: manualIndex.salons[salonIndex], check: restoredCheck });
  });

  app.post("/api/admin/stylists/intake", requireAdmin, async (req, res) => {
    const draft = await buildDraft(req.body || {});
    const store = await readDraftStore();
    store.drafts.unshift(draft);
    await writeDraftStore(store);
    res.status(201).json({ ok: true, draft });
  });

  app.post("/api/admin/stylists/intake-bulk", requireAdmin, async (req, res) => {
    const candidates = parseBulkIntake(req.body?.text);
    if (!candidates.length) {
      return res.status(400).json({ ok: false, message: "Paste at least one social, booking, or website link." });
    }

    const drafts = await Promise.all(candidates.map((candidate) => buildDraft(candidate)));
    const store = await readDraftStore();
    store.drafts.unshift(...drafts);
    await writeDraftStore(store);
    res.status(201).json({ ok: true, drafts });
  });

  app.get("/api/admin/discovery", requireAdmin, async (_req, res) => {
    const store = await readDiscoveryStore();
    res.json({ ok: true, suggestions: store.suggestions, meta: store.meta });
  });

  app.post("/api/admin/discovery/generate", requireAdmin, async (_req, res) => {
    const suggestions = await generateDiscoverySuggestions();
    const store = await readDiscoveryStore();
    const existingKeys = new Set(store.suggestions.map((suggestion) => suggestion.id));
    const mergedSuggestions = [...suggestions.filter((suggestion) => !existingKeys.has(suggestion.id)), ...store.suggestions];
    await writeDiscoveryStore(mergedSuggestions);
    res.json({ ok: true, suggestions: mergedSuggestions });
  });

  app.post("/api/admin/discovery/:id/create-draft", requireAdmin, async (req, res) => {
    const store = await readDiscoveryStore();
    const suggestion = store.suggestions.find((item) => item.id === req.params.id);
    if (!suggestion) {
      return res.status(404).json({ ok: false, message: "Suggestion not found." });
    }

    const draft = await buildDraft({
      links: suggestion.sourceUrl,
      name: suggestion.name,
      areaId: suggestion.areaId,
      rawServices: suggestion.services.join("\n"),
      services: suggestion.services,
      summary: suggestion.reason,
    });
    const draftStore = await readDraftStore();
    draftStore.drafts.unshift(draft);
    await writeDraftStore(draftStore);
    await writeDiscoveryStore(
      store.suggestions.map((item) => (item.id === suggestion.id ? { ...item, status: "draft_created", updatedAt: new Date().toISOString() } : item)),
    );
    res.status(201).json({ ok: true, draft });
  });

  app.patch("/api/admin/stylists/drafts/:id", requireAdmin, async (req, res) => {
    const store = await readDraftStore();
    const draftIndex = store.drafts.findIndex((draft) => draft.id === req.params.id);
    if (draftIndex === -1) {
      return res.status(404).json({ ok: false, message: "Draft not found." });
    }

    store.drafts[draftIndex] = normalizeDraftState({
      ...store.drafts[draftIndex],
      ...sanitizeDraftUpdate(req.body || {}),
      updatedAt: new Date().toISOString(),
    });
    await writeDraftStore(store);
    res.json({ ok: true, draft: store.drafts[draftIndex] });
  });

  app.post("/api/admin/stylists/drafts/:id/approve", requireAdmin, async (req, res) => {
    const store = await readDraftStore();
    const draftIndex = store.drafts.findIndex((draft) => draft.id === req.params.id);
    if (draftIndex === -1) {
      return res.status(404).json({ ok: false, message: "Draft not found." });
    }

    const draft = {
      ...store.drafts[draftIndex],
      ...sanitizeDraftUpdate(req.body || {}),
    };
    const validationMessage = validateApprovableDraft(draft);
    if (validationMessage) {
      return res.status(400).json({ ok: false, message: validationMessage });
    }

    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const existingIds = new Set(manualIndex.salons.map((salon) => salon.id));
    const salon = draftToSalon(draft, existingIds);
    manualIndex.salons.unshift(salon);
    manualIndex.meta = {
      ...manualIndex.meta,
      updatedAt: new Date().toISOString(),
      count: manualIndex.salons.length,
    };

    store.drafts.splice(draftIndex, 1);
    if (isGitHubJsonBacked()) {
      await writeJsonFilesToGitHub(
        [
          { path: "data/manual-salons.json", payload: manualIndex },
          { path: "data/stylist-drafts.json", payload: buildDraftStorePayload(store) },
        ],
        `Publish ${salon.name}`,
      );
    } else {
      await writeJson(manualIndexPath, manualIndex);
      await writeDraftStore(store);
    }

    res.json({ ok: true, salon });
  });

  app.delete("/api/admin/stylists/drafts/:id", requireAdmin, async (req, res) => {
    const store = await readDraftStore();
    const nextDrafts = store.drafts.filter((draft) => draft.id !== req.params.id);
    if (nextDrafts.length === store.drafts.length) {
      return res.status(404).json({ ok: false, message: "Draft not found." });
    }

    store.drafts = nextDrafts;
    await writeDraftStore(store);
    res.json({ ok: true });
  });
}

function requireAdmin(req, res, next) {
  const configuredPassword = getAdminPassword();
  if (!configuredPassword) {
    return res.status(503).json({ ok: false, message: "Set ADMIN_PASSWORD before using the admin tool." });
  }

  const token = getCookieValue(req.headers.cookie, sessionCookieName);
  const session = token ? verifySessionToken(token, configuredPassword) : null;
  if (!session) {
    res.setHeader("Set-Cookie", expireCookie());
    return res.status(401).json({ ok: false, message: "Admin login required." });
  }

  if (Date.now() - session.createdAt > sessionMaxAgeSeconds * 1000) {
    res.setHeader("Set-Cookie", expireCookie());
    return res.status(401).json({ ok: false, message: "Admin session expired." });
  }

  next();
}

function getAdminPassword() {
  const configuredPassword = (process.env.ADMIN_PASSWORD || process.env.ROWK_ADMIN_PASSWORD || "").trim();
  if (configuredPassword) {
    return configuredPassword;
  }

  return isHostedRuntime() ? "" : "rowk-admin";
}

function createSessionToken() {
  const createdAt = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${createdAt}.${nonce}`;
  return `${payload}.${signSessionPayload(payload, getAdminPassword())}`;
}

function verifySessionToken(token, password) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [createdAt, nonce, signature] = parts;
  const payload = `${createdAt}.${nonce}`;
  const expectedSignature = signSessionPayload(payload, password);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const createdAtNumber = Number(createdAt);
  return Number.isFinite(createdAtNumber) ? { createdAt: createdAtNumber } : null;
}

function signSessionPayload(payload, password) {
  return crypto.createHmac("sha256", password).update(payload).digest("base64url");
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function makeCookie(token) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : "";
  return `${sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

function expireCookie() {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : "";
  return `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function getCookieValue(cookieHeader = "", name) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function readDraftStore() {
  const store = await readJson(draftsPath, { meta: { source: "admin-drafts" }, drafts: [] });
  return {
    meta: {
      source: "admin-drafts",
      updatedAt: store.meta?.updatedAt ?? null,
      count: Array.isArray(store.drafts) ? store.drafts.length : 0,
    },
    drafts: Array.isArray(store.drafts) ? store.drafts : [],
  };
}

async function writeDraftStore(store) {
  await writeJson(draftsPath, buildDraftStorePayload(store));
}

function buildDraftStorePayload(store) {
  return {
    meta: {
      source: "admin-drafts",
      updatedAt: new Date().toISOString(),
      count: store.drafts.length,
    },
    drafts: store.drafts,
  };
}

async function readDiscoveryStore() {
  const store = await readJson(discoverySuggestionsPath, { meta: { source: "discovery-suggestions", updatedAt: null, count: 0 }, suggestions: [] });
  return {
    meta: {
      source: "discovery-suggestions",
      updatedAt: store.meta?.updatedAt ?? null,
      count: Array.isArray(store.suggestions) ? store.suggestions.length : 0,
    },
    suggestions: Array.isArray(store.suggestions) ? store.suggestions : [],
  };
}

async function writeDiscoveryStore(suggestions) {
  await writeJson(discoverySuggestionsPath, {
    meta: {
      source: "discovery-suggestions",
      updatedAt: new Date().toISOString(),
      count: suggestions.length,
    },
    suggestions,
  });
}

async function readFreshnessStore(fallback) {
  if (isGitHubJsonBacked()) {
    try {
      return await readJsonFromGitHub("data/freshness-checks.json");
    } catch (error) {
      console.warn("Could not read latest freshness checks from GitHub. Falling back to deployed file.", error);
    }
  }

  return readJson(freshnessChecksPath, fallback);
}

async function writeFreshnessStore(payload) {
  if (isGitHubJsonBacked()) {
    await writeJsonToGitHub("data/freshness-checks.json", payload);
    return;
  }

  await writeJson(freshnessChecksPath, payload);
}

async function readJson(filePath, fallback) {
  const githubPath = getGitHubBackedJsonPath(filePath, { requireToken: false });
  if (githubPath && getGitHubToken()) {
    try {
      return await readJsonFromGitHub(githubPath);
    } catch (error) {
      console.warn(`Could not read latest ${githubPath} from GitHub. Falling back to deployed file.`, error);
    }
  }

  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, payload) {
  const githubPath = getGitHubBackedJsonPath(filePath);
  if (githubPath) {
    await writeJsonToGitHub(githubPath, payload);
    return;
  }

  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function getGitHubBackedJsonPath(filePath, { requireToken = true } = {}) {
  const relativePath = path.relative(repositoryRoot, filePath).split(path.sep).join("/");
  if (!githubBackedJsonPaths.has(relativePath)) {
    return "";
  }

  if (!isHostedRuntime()) {
    return "";
  }

  if (requireToken && !getGitHubToken()) {
    throw new Error("Set GITHUB_TOKEN in Vercel before saving admin changes.");
  }

  return relativePath;
}

function isGitHubJsonBacked() {
  return isHostedRuntime() && Boolean(getGitHubToken());
}

async function readJsonFromGitHub(filePath) {
  const repo = getGitHubRepository();
  const branch = getGitHubBranch();
  const apiPath = filePath.split("/").map(encodeURIComponent).join("/");
  const response = await githubFetch(`https://api.github.com/repos/${repo}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`);
  const file = await parseGitHubResponse(response);
  return JSON.parse(Buffer.from(file.content || "", "base64").toString("utf8"));
}

async function writeJsonToGitHub(filePath, payload) {
  const repo = getGitHubRepository();
  const branch = getGitHubBranch();
  const token = getGitHubToken();
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const apiPath = filePath.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${repo}/contents/${apiPath}`;
  const currentResponse = await githubFetch(`${url}?ref=${encodeURIComponent(branch)}`);
  const currentFile = currentResponse.status === 404 ? null : await parseGitHubResponse(currentResponse);
  const updateResponse = await githubFetch(url, {
    method: "PUT",
    body: JSON.stringify({
      message: commitMessageForJsonPath(filePath),
      content: Buffer.from(content).toString("base64"),
      branch,
      ...(currentFile?.sha ? { sha: currentFile.sha } : {}),
    }),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text().catch(() => "");
    throw new Error(`GitHub save failed for ${filePath}: ${updateResponse.status} ${errorText}`);
  }
}

async function writeJsonFilesToGitHub(files, message) {
  const repo = getGitHubRepository();
  const branch = getGitHubBranch();
  const branchRef = await parseGitHubResponse(await githubFetch(`https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`));
  const parentSha = branchRef.object?.sha;
  if (!parentSha) {
    throw new Error(`Could not resolve GitHub branch ${branch}.`);
  }

  const parentCommit = await parseGitHubResponse(await githubFetch(`https://api.github.com/repos/${repo}/git/commits/${parentSha}`));
  const tree = await parseGitHubResponse(
    await githubFetch(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: parentCommit.tree?.sha,
        tree: files.map((file) => ({
          path: file.path,
          mode: "100644",
          type: "blob",
          content: `${JSON.stringify(file.payload, null, 2)}\n`,
        })),
      }),
    }),
  );
  const commit = await parseGitHubResponse(
    await githubFetch(`https://api.github.com/repos/${repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: [parentSha],
      }),
    }),
  );
  const updateResponse = await githubFetch(`https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text().catch(() => "");
    throw new Error(`GitHub commit failed: ${updateResponse.status} ${errorText}`);
  }
}

async function githubFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${getGitHubToken()}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
}

async function parseGitHubResponse(response) {
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`GitHub read failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

function commitMessageForJsonPath(filePath) {
  if (filePath === "data/manual-salons.json") {
    return "Update stylist directory data";
  }
  if (filePath === "data/stylist-drafts.json") {
    return "Update admin stylist drafts";
  }
  if (filePath === "data/freshness-checks.json") {
    return "Update health check results";
  }
  return "Update admin discovery data";
}

function isHostedRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function getGitHubToken() {
  return (process.env.GITHUB_TOKEN || process.env.ROWK_GITHUB_TOKEN || "").trim();
}

function getGitHubRepository() {
  return (process.env.GITHUB_REPOSITORY || process.env.ROWK_GITHUB_REPOSITORY || "annodu/row-k").trim();
}

function getGitHubBranch() {
  return (process.env.GITHUB_BRANCH || process.env.ROWK_GITHUB_BRANCH || "main").trim();
}

async function tryWriteJson(filePath, payload) {
  try {
    await writeJson(filePath, payload);
    return true;
  } catch (error) {
    console.warn(`Could not persist ${path.basename(filePath)}. Returning in-memory results only.`, error);
    return false;
  }
}

async function updateFreshnessReview(salonId, { addServices = [], removeServices = [], rejectAddedServices = [], rejectRemovedServices = [], bookingUrl, instagramUrl, websiteUrl }) {
  const store = await readFreshnessStore({ meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [], dismissedRecommendations: {} });
  const reviewedAdds = normalizeServices([...addServices, ...rejectAddedServices]);
  const reviewedRemoves = normalizeServices([...removeServices, ...rejectRemovedServices]);
  const currentCheck = (store.checks || []).find((check) => check.id === salonId);
  const dismissedRecommendations = updateDismissedRecommendations(store.dismissedRecommendations || {}, salonId, {
    rejectAddedServices,
    rejectRemovedServices,
    rawServices: currentCheck?.serviceCheck?.rawServices || [],
  });
  const checks = (store.checks || [])
    .map((check) => {
      if (check.id !== salonId) {
        return check;
      }
      const reviewedLinkTypes = getReviewedLinkTypes({ bookingUrl, instagramUrl, websiteUrl });
      const reviewedLinkIssues = new Set(
        (check.linkChecks || [])
          .filter((linkCheck) => reviewedLinkTypes.has(linkCheck.type))
          .flatMap((linkCheck) => linkCheck.issues || []),
      );

      return {
        ...check,
        ...(bookingUrl !== undefined ? { bookingUrl } : {}),
        ...(instagramUrl !== undefined ? { instagramUrl } : {}),
        ...(websiteUrl !== undefined ? { websiteUrl } : {}),
        addedServices: (check.addedServices || []).filter((service) => !reviewedAdds.includes(service)),
        removedServices: (check.removedServices || []).filter((service) => !reviewedRemoves.includes(service)),
        linkChecks: (check.linkChecks || []).filter((linkCheck) => !reviewedLinkTypes.has(linkCheck.type)),
        issues: (check.issues || []).filter((issue) => !reviewedLinkIssues.has(issue)),
        reviewedAt: new Date().toISOString(),
      };
    })
    .filter(hasActionableFreshnessCheck);

  await writeFreshnessStore({
    meta: {
      ...(store.meta || {}),
      source: "freshness-checks",
      updatedAt: new Date().toISOString(),
      count: checks.length,
    },
    dismissedRecommendations,
    checks,
  });
}

function getReviewedLinkTypes({ bookingUrl, instagramUrl, websiteUrl }) {
  const reviewedLinkTypes = new Set();
  if (bookingUrl !== undefined) {
    reviewedLinkTypes.add("booking");
  }
  if (websiteUrl !== undefined) {
    reviewedLinkTypes.add("website");
  }
  if (instagramUrl !== undefined) {
    reviewedLinkTypes.add("instagram");
  }
  return reviewedLinkTypes;
}

async function undoFreshnessReview(salonId, { check, rejectAddedServices = [], rejectRemovedServices = [] }) {
  const store = await readFreshnessStore({ meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [], dismissedRecommendations: {} });
  const dismissedRecommendations = removeDismissedRecommendations(store.dismissedRecommendations || {}, salonId, {
    rejectAddedServices,
    rejectRemovedServices,
  });
  const sanitizedCheck = sanitizeFreshnessCheck(check, salonId);
  const checks = sanitizedCheck
    ? [sanitizedCheck, ...(store.checks || []).filter((item) => item.id !== salonId)]
    : store.checks || [];

  await writeFreshnessStore({
    meta: {
      ...(store.meta || {}),
      source: "freshness-checks",
      updatedAt: new Date().toISOString(),
      count: checks.length,
    },
    dismissedRecommendations,
    checks,
  });

  return sanitizedCheck;
}

function updateDismissedRecommendations(dismissedRecommendations, salonId, { rejectAddedServices = [], rejectRemovedServices = [], rawServices = [] }) {
  const rejectedAdds = normalizeServices(rejectAddedServices);
  const rejectedRemoves = normalizeServices(rejectRemovedServices);
  if (!rejectedAdds.length && !rejectedRemoves.length) {
    return dismissedRecommendations;
  }

  const current = dismissedRecommendations[salonId] || {};
  const addedServiceEvidence = { ...(current.addedServiceEvidence || {}) };
  rejectedAdds.forEach((service) => {
    const evidence = getServiceEvidence(rawServices, service);
    if (evidence.length) {
      addedServiceEvidence[service] = [...new Set([...(addedServiceEvidence[service] || []), ...evidence])];
    }
  });
  return {
    ...dismissedRecommendations,
    [salonId]: {
      addedServices: [...new Set([...(current.addedServices || []), ...rejectedAdds])],
      removedServices: [...new Set([...(current.removedServices || []), ...rejectedRemoves])],
      addedServiceFamilies: [...new Set([...(current.addedServiceFamilies || []), ...rejectedAdds.map(serviceFamilyFor).filter(Boolean)])],
      addedServiceEvidence,
    },
  };
}

function removeDismissedRecommendations(dismissedRecommendations, salonId, { rejectAddedServices = [], rejectRemovedServices = [] }) {
  const rejectedAdds = normalizeServices(rejectAddedServices);
  const rejectedRemoves = normalizeServices(rejectRemovedServices);
  if (!rejectedAdds.length && !rejectedRemoves.length) {
    return dismissedRecommendations;
  }

  const current = dismissedRecommendations[salonId] || {};
  const next = {
    addedServices: (current.addedServices || []).filter((service) => !rejectedAdds.includes(service)),
    removedServices: (current.removedServices || []).filter((service) => !rejectedRemoves.includes(service)),
    addedServiceFamilies: (current.addedServiceFamilies || []).filter((family) => !rejectedAdds.map(serviceFamilyFor).includes(family)),
    addedServiceEvidence: Object.fromEntries(Object.entries(current.addedServiceEvidence || {}).filter(([service]) => !rejectedAdds.includes(service))),
  };
  const updated = { ...dismissedRecommendations };
  if (next.addedServices.length || next.removedServices.length) {
    updated[salonId] = next;
  } else {
    delete updated[salonId];
  }
  return updated;
}

function sanitizeFreshnessCheck(check, salonId) {
  if (!check || check.id !== salonId) {
    return null;
  }

  return {
    id: salonId,
    name: cleanString(check.name),
    areaLabel: cleanString(check.areaLabel),
    bookingUrl: cleanString(check.bookingUrl),
    instagramUrl: cleanString(check.instagramUrl),
    websiteUrl: cleanString(check.websiteUrl),
    issues: toArray(check.issues),
    linkChecks: Array.isArray(check.linkChecks) ? check.linkChecks : [],
    serviceCheck: check.serviceCheck || emptyServiceCheck(),
    currentServices: normalizeServices(toArray(check.currentServices)),
    detectedServices: normalizeServices(toArray(check.detectedServices)),
    addedServices: normalizeServices(toArray(check.addedServices)),
    removedServices: normalizeServices(toArray(check.removedServices)),
    checkedAt: check.checkedAt || new Date().toISOString(),
  };
}

function hasActionableFreshnessCheck(check) {
  if (check.addedServices?.length || check.removedServices?.length) {
    return true;
  }

  if (check.linkChecks?.some(isActionableBrokenLink)) {
    return true;
  }

  return (check.issues || []).some((issue) => {
    const normalizedIssue = String(issue).toLowerCase();
    return normalizedIssue !== "possible new services found" && normalizedIssue !== "possible removed services found";
  });
}

function mergeFreshnessChecks(existingChecks, nextChecks) {
  const merged = [...existingChecks];
  const indexesById = new Map(merged.map((check, index) => [check.id, index]));

  nextChecks.forEach((check) => {
    const existingIndex = indexesById.get(check.id);
    if (existingIndex === undefined) {
      indexesById.set(check.id, merged.length);
      merged.push(check);
      return;
    }

    merged[existingIndex] = check;
  });

  return merged;
}

function preserveKnownBrokenInstagramLink(linkChecks, previousCheck) {
  const previousInstagramCheck = previousCheck?.linkChecks?.find((linkCheck) => linkCheck.type === "instagram");
  if (!isActionableBrokenLink(previousInstagramCheck)) {
    return linkChecks;
  }

  return linkChecks.map((linkCheck) => {
    if (linkCheck?.type !== "instagram") {
      return linkCheck;
    }

    return isWeakInstagramOk(linkCheck) ? previousInstagramCheck : linkCheck;
  });
}

function isWeakInstagramOk(linkCheck) {
  return linkCheck?.type === "instagram" && linkCheck.status === "ok" && isInstagramLoginUrl(linkCheck.finalUrl);
}

async function checkSalonFreshness(salon, dismissedRecommendation = {}, previousCheck = null) {
  const [bookingLinkCheck, ...otherLinkChecks] = await Promise.all([
    checkUrl("booking", salon.bookingUrl, { includeText: true }),
    checkUrl("instagram", salon.instagramUrl),
    checkUrl("website", salon.websiteUrl && salon.websiteUrl !== salon.bookingUrl ? salon.websiteUrl : ""),
  ]);
  const linkChecks = preserveKnownBrokenInstagramLink([stripLinkCheckResponseText(bookingLinkCheck), ...otherLinkChecks], previousCheck);
  const activeLinkChecks = linkChecks.filter(Boolean);
  const issues = activeLinkChecks.flatMap((check) => check.issues);
  const bookingCheck = activeLinkChecks.find((check) => check.type === "booking");
  const serviceCheck = bookingCheck?.status === "ok" ? extractBookingServicesFromHtml(bookingLinkCheck?.responseText || "") : emptyServiceCheck();
  const currentServices = normalizeServices(salon.services || []);
  const detectedServices = adjustDetectedServicesForCurrentContext(normalizeServices(serviceCheck.matchedServices), currentServices, serviceCheck.rawServices);
  const dismissedAddedServices = normalizeServices(dismissedRecommendation.addedServices || []);
  const dismissedRemovedServices = normalizeServices(dismissedRecommendation.removedServices || []);
  const dismissedAddedFamilies = new Set(dismissedRecommendation.addedServiceFamilies || []);
  const addedServices = detectedServices.filter((service) => {
    if (currentServices.includes(service) || dismissedAddedServices.includes(service)) {
      return false;
    }

    const family = serviceFamilyFor(service);
    if (!family || !dismissedAddedFamilies.has(family)) {
      return true;
    }

    return !hasDismissedFamilyContext(serviceCheck.rawServices, service);
  });
  const removedServices =
    serviceCheck.confidence === "medium" || serviceCheck.confidence === "high"
      ? currentServices.filter((service) => !detectedServices.includes(service) && !dismissedRemovedServices.includes(service))
      : [];

  if (addedServices.length > 0) {
    issues.push("Possible new services found");
  }
  if (removedServices.length > 0) {
    issues.push("Possible removed services found");
  }

  return {
    id: salon.id,
    name: salon.name,
    areaLabel: salon.areaLabel,
    bookingUrl: salon.bookingUrl || "",
    instagramUrl: salon.instagramUrl || "",
    websiteUrl: salon.websiteUrl || "",
    issues: [...new Set(issues)],
    linkChecks: activeLinkChecks,
    serviceCheck,
    currentServices,
    detectedServices,
    addedServices,
    removedServices,
    checkedAt: new Date().toISOString(),
  };
}

function adjustDetectedServicesForCurrentContext(detectedServices, currentServices, rawServices) {
  const naturalColourServices = ["Full head colour", "Balayage", "Highlights"];
  const hasNaturalColourDetection = detectedServices.some((service) => naturalColourServices.includes(service));
  const hasExistingWigColour = currentServices.includes("Wig colour");
  const rawText = normalizeServiceText(rawServices.join(" "));
  const hasWigOrBundleContext = /\b(wig|wigs|unit|units|lace|lace\s+system|closure|frontal|bundle|bundles|extensions?|weft|wefts|613|non[\s-]*contact)\b/.test(rawText);
  const hasPixieInstallContext = /\bpixie\b/.test(rawText) && /\b(wig|weave|sew\s*in|sewin|install|installation)\b/.test(rawText);
  const adjustedServices = hasPixieInstallContext
    ? normalizeServices([
        ...detectedServices.filter((service) => service !== "Pixie / finger waves"),
        "Pixie wig / weave install",
      ])
    : detectedServices;

  if (!hasExistingWigColour || !hasNaturalColourDetection || !hasWigOrBundleContext) {
    return adjustedServices;
  }

  return normalizeServices([
    ...adjustedServices.filter((service) => !naturalColourServices.includes(service)),
    "Wig colour",
  ]);
}

function hasDismissedFamilyContext(rawServices = [], service) {
  const family = serviceFamilyFor(service);
  const normalizedRaw = normalizeServiceText(rawServices.join(" "));

  if (family === "colour") {
    return /\b(colou?r|highlight|balayage|tone|tint|bleach|root)\b/.test(normalizedRaw);
  }

  if (family === "wig") {
    return /\b(wig|unit|lace|closure|frontal)\b/.test(normalizedRaw);
  }

  return false;
}

function getServiceEvidence(rawServices = [], service) {
  const keywords = serviceEvidenceKeywords[service] || service.toLowerCase().split(/\s+|\/|\(|\)|-/).filter((word) => word.length > 3);
  const normalizedKeywords = keywords.map(normalizeServiceText);
  const matches = rawServices.filter((line) => {
    const normalizedLine = normalizeServiceText(line);
    return normalizedKeywords.some((keyword) => keyword && normalizedLine.includes(keyword));
  });

  if (matches.length) {
    return matches.slice(0, 4);
  }

  return rawServices.filter((line) => serviceFamilyFor(service) === "colour" && /colou?r|highlight|balayage|tone|tint|bleach|root/i.test(line)).slice(0, 4);
}

const serviceEvidenceKeywords = {
  "Balayage": ["balayage"],
  "Highlights": ["highlight", "highlights", "lowlights"],
  "Full head colour": ["colour", "color", "tint", "dye", "rooting"],
  "Wig colour": ["wig colour", "wig color", "wig colouring service", "hair bundle colouring service", "lace closure colouring", "lace frontal colouring", "colouring full wig", "custom colour", "colour service", "613", "non-contact", "non contact", "bundle", "bundles", "frontal", "closure"],
  "Custom wig": ["custom wig", "bespoke wig", "custom lace", "custom unit", "customised closure unit", "customized closure unit", "custom mini frontal unit", "unit customisation", "unit customization", "wig making", "wig construction", "construction of wig", "construction of the wig", "wig customising", "wig customisation", "wig customization", "construction and customisation", "construction and customization"],
  "Feed-in braids": ["feed in", "feed-in", "all back", "braids going back", "cornrows incl extensions", "cornrows including extensions", "cornrows with extensions", "pre pulled packets", "pre-pulled packets"],
  "K-tips / Invisible strands": ["k tips", "k-tips", "keratin tip", "keratin tips", "keratin bonds", "invisible strands"],
  "Wig install (frontal / closure)": ["wig install", "wig installation", "wig application", "wig fitting", "glueless wig", "lace wig", "frontal wig", "closure wig", "wig frontal install", "wig closure install", "lace frontal installation", "lace closure installation", "frontal unit", "closure unit", "ready-made unit", "ready made unit", "unit install", "frontal unit install", "closure unit install"],
  "Pixie wig / weave install": ["pixie wig", "pixie weave", "pixie install", "pixie cut wig making", "pixie cut wig making styling"],
  "Tracks (+ Silk press) / Partial / Invisible sew-in": ["tracks", "track per row", "per track", "per row", "one row", "individual sewn on track", "individual sewn on tracks", "tracks add on", "tracks add-on", "silk press add on tracks", "silk press add-on tracks", "sew in tracks", "sew-in tracks", "weave tracks", "single track weave"],
  "Twists (with extensions)": ["twists with extensions", "passion twists", "marley twists", "senegalese twists", "kinky twists", "rope twists", "island twists", "island twist", "large twist", "large twists"],
  "Wash & blowdry": ["wash blowdry", "wash blow dry", "wash and blowdry", "wash and blow dry", "washing blow drying", "washing and blow drying", "shampoo blowdry", "shampoo blow dry", "shampoo and blowdry", "shampoo and blow dry", "blowout"],
  "Wig cornrows": ["under wig", "wig cornrows", "wig cainrows", "cornrows for wig installation", "cornrows without extensions", "cainrows"],
};

function serviceFamilyFor(service) {
  if (["Full head colour", "Balayage", "Highlights", "Wig colour"].includes(service)) {
    return "colour";
  }
  if (["Custom wig", "Wig install (frontal / closure)", "U-Part wig install", "Pixie wig / weave install"].includes(service)) {
    return "wig";
  }
  return "";
}

async function checkUrl(type, url, { includeText = false } = {}) {
  if (!url) {
    return null;
  }

  const result = {
    type,
    url,
    finalUrl: url,
    status: "unknown",
    httpStatus: null,
    issues: [],
  };

  try {
    if (type === "instagram") {
      const instagramProfileCheck = await checkInstagramProfileUrl(result);
      if (instagramProfileCheck) {
        return instagramProfileCheck;
      }
    }

    const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
    result.finalUrl = response.url || url;
    result.httpStatus = response.status;
    const instagramIssue = type === "instagram" ? getInstagramProfileIssue(url, result.finalUrl) : "";
    const isWeakInstagramLoginShell = type === "instagram" && isInstagramLoginUrl(result.finalUrl);

    if (response.ok) {
      result.status = instagramIssue || isWeakInstagramLoginShell ? "unverified" : "ok";
      if (instagramIssue) {
        result.issues.push(instagramIssue);
      }
      if (includeText && result.status === "ok") {
        result.responseText = await response.text();
      }
    } else if (response.status === 404 || response.status === 410) {
      result.status = "broken";
      result.issues.push(`${linkLabel(type)} appears to be gone`);
    } else if (response.status === 401 || response.status === 403 || response.status === 429) {
      result.status = "unverified";
    } else {
      result.status = "unverified";
    }

    const originalHost = safeHost(url);
    const finalHost = safeHost(result.finalUrl);
    if (originalHost && finalHost && originalHost !== finalHost && !isExpectedRedirect(originalHost, finalHost)) {
      result.issues.push(`${linkLabel(type)} redirects to ${finalHost}`);
    }
  } catch (error) {
    result.status = "unverified";
  }

  return result;
}

async function checkInstagramProfileUrl(result) {
  const profile = getInstagramProfilePath(result.url);
  if (!profile) {
    return null;
  }

  const apiUrl = new URL("https://www.instagram.com/api/v1/users/web_profile_info/");
  apiUrl.searchParams.set("username", profile);

  try {
    const response = await fetchInstagramProfileWithThrottle(apiUrl.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": browserUserAgent,
        Referer: "https://www.instagram.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    result.httpStatus = response.status;

    if (response.ok) {
      const profileData = await response.json();
      const resolvedUsername = String(profileData?.data?.user?.username || "").toLowerCase();
      if (resolvedUsername === profile) {
        result.status = "ok";
      } else {
        result.status = "unverified";
        result.issues.push(resolvedUsername ? `Instagram profile resolved as /${resolvedUsername}/ instead of /${profile}/` : "Instagram profile response did not include a username");
      }
      return result;
    }

    if (response.status === 404 || response.status === 410) {
      result.status = "broken";
      result.issues.push("Instagram profile appears to be gone");
      return result;
    }

    if (response.status === 401 || response.status === 403 || response.status === 429) {
      return null;
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchInstagramProfileWithThrottle(url, options) {
  const now = Date.now();
  const waitMs = Math.max(0, nextInstagramProfileProbeAt - now);
  nextInstagramProfileProbeAt = Math.max(now, nextInstagramProfileProbeAt) + 900;

  if (waitMs) {
    await wait(waitMs);
  }

  return fetchWithTimeout(url, options);
}

function stripLinkCheckResponseText(linkCheck) {
  if (!linkCheck) {
    return null;
  }

  const { responseText, ...rest } = linkCheck;
  return rest;
}

function isActionableBrokenLink(linkCheck) {
  return linkCheck?.status === "broken" && (linkCheck.httpStatus === 404 || linkCheck.httpStatus === 410);
}

function isManualCheckLink(linkCheck) {
  return Boolean(linkCheck) && linkCheck.status !== "ok" && !isActionableBrokenLink(linkCheck);
}

async function extractBookingServices(url) {
  try {
    const response = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
    if (!response.ok) {
      return emptyServiceCheck();
    }

    return extractBookingServicesFromHtml(await response.text());
  } catch {
    return emptyServiceCheck();
  }
}

function extractBookingServicesFromHtml(html) {
  if (!html) {
    return emptyServiceCheck();
  }

  const structured = extractStructuredBookingData(html);
  const rawServices = structured.rawServices.length ? structured.rawServices : extractServiceCandidates(html);
  const matchedServices = matchServices(rawServices);
  return {
    confidence: structured.rawServices.length >= 3 && matchedServices.length > 0 ? "high" : rawServices.length >= 5 && matchedServices.length > 0 ? "medium" : matchedServices.length > 0 ? "low" : "unknown",
    rawServices: rawServices.slice(0, 80),
    matchedServices,
    areaId: structured.areaId,
    areaLabel: areaLabelFor(structured.areaId),
  };
}

function extractStructuredBookingData(html) {
  const business = extractAcuityBusiness(html);
  if (!business) {
    return { rawServices: [], areaId: "" };
  }

  const appointmentTypes = business.appointmentTypes && typeof business.appointmentTypes === "object" ? business.appointmentTypes : {};
  const rawServices = [];
  Object.entries(appointmentTypes).forEach(([category, appointments]) => {
    rawServices.push(category);
    if (Array.isArray(appointments)) {
      appointments.forEach((appointment) => {
        rawServices.push(appointment.name);
      });
    }
  });

  const calendarLocations = Object.values(business.calendars || {})
    .flat()
    .map((calendar) => calendar?.location)
    .filter(Boolean);
  const calendarTimezones = Object.values(business.calendars || {})
    .flat()
    .map((calendar) => calendar?.timezone)
    .filter(Boolean);
  const areaId =
    inferAreaIdFromText([business.name, business.description, ...calendarLocations].join(" ")) ||
    (calendarTimezones.includes("Europe/London") ? "all-london" : "");

  return {
    rawServices: rawServices.filter(Boolean).map((service) => String(service).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
    areaId,
  };
}

function extractAcuityBusiness(html) {
  const marker = "var BUSINESS = ";
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const objectStart = html.indexOf("{", markerIndex);
  if (objectStart === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      escaped = !escaped && char === "\\";
      if (char === "\"" && !escaped) {
        inString = false;
      }
      if (char !== "\\") {
        escaped = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(objectStart, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function extractServiceCandidates(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  return [
    ...new Set(
      text
        .split(/\n|•|·|\|/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length >= 4 && line.length <= 90)
        .filter((line) => /braid|loc|wig|weave|sew|silk|press|tape|micro|clip|colour|color|cut|trim|wash|blow|treat|keratin|relax|pony|bun|updo|bridal|curl|cornrow|closure|frontal|track/i.test(line))
        .filter((line) => !/cookie|privacy|terms|login|sign in|copyright|javascript|instagram|facebook/i.test(line)),
    ),
  ];
}

function emptyServiceCheck() {
  return {
    confidence: "unknown",
    rawServices: [],
    matchedServices: [],
    areaId: "",
    areaLabel: "",
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "ROW K freshness checker",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, mapper, { delayMs = 0 } = {}) {
  const results = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (delayMs && currentIndex > 0) {
        await wait(delayMs * currentIndex);
      }
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function linkLabel(type) {
  return type === "booking" ? "Booking link" : type === "instagram" ? "Instagram" : "Website";
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isExpectedRedirect(originalHost, finalHost) {
  return originalHost === finalHost || finalHost.endsWith(`.${originalHost}`) || originalHost.endsWith(`.${finalHost}`);
}

function getInstagramProfileIssue(originalUrl, finalUrl) {
  const originalProfile = getInstagramProfilePath(originalUrl);
  const finalProfile = getInstagramProfilePath(finalUrl);

  if (!originalProfile) {
    return "";
  }

  if (isInstagramLoginUrl(finalUrl)) {
    return "";
  }

  if (!finalProfile) {
    return "Instagram no longer resolves to the saved profile";
  }

  if (originalProfile !== finalProfile) {
    return `Instagram redirects from /${originalProfile}/ to /${finalProfile}/`;
  }

  return "";
}

function getInstagramProfilePath(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "instagram.com") {
    return "";
  }

  const [profilePath = ""] = parsed.pathname.split("/").filter(Boolean);
  if (!profilePath || reservedInstagramPaths.has(profilePath.toLowerCase())) {
    return "";
  }

  return profilePath.toLowerCase();
}

function isInstagramLoginUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") === "instagram.com" && parsed.pathname.startsWith("/accounts/login");
  } catch {
    return false;
  }
}

const reservedInstagramPaths = new Set(["accounts", "about", "api", "developer", "direct", "explore", "legal", "oauth", "p", "reel", "stories"]);

async function buildDraft(input) {
  const links = normalizeLines(input.links);
  const rawServices = normalizeLines(input.rawServices);
  const explicitServices = toArray(input.services);
  const inferred = inferFromLinks(links);
  const bookingServiceCheck = inferred.bookingUrl ? await extractBookingServices(inferred.bookingUrl) : emptyServiceCheck();
  const enrichedRawServices = [...rawServices, ...bookingServiceCheck.rawServices];
  const matchedServices = matchServices([...enrichedRawServices, ...bookingServiceCheck.matchedServices, ...explicitServices]);
  const now = new Date().toISOString();
  const name = cleanString(input.name) || inferNameFromUrl(links[0]) || "New stylist";
  const inferredAreaId = cleanString(input.areaId) || bookingServiceCheck.areaId || inferAreaIdFromText([...links, name, ...enrichedRawServices].join(" "));
  const areaIds = normalizeAreaIds(input.areaIds?.length ? input.areaIds : inferredAreaId ? [inferredAreaId] : []);
  const areaLabel = areaLabelForIds(areaIds);

  return normalizeDraftState({
    id: makeUniqueDraftId(name),
    status: "needs_review",
    name,
    areaId: areaIds[0] || "",
    areaIds,
    areaLabel,
    neighbourhood: areaLabel ? `${areaLabel.replace(" / ", " and ")} London` : "",
    postcode: "",
    bookingPlatform: cleanString(input.bookingPlatform) || inferred.bookingPlatform,
    bookingUrl: cleanString(input.bookingUrl) || inferred.bookingUrl,
    websiteUrl: cleanString(input.websiteUrl) || inferred.websiteUrl,
    instagramUrl: cleanString(input.instagramUrl) || inferred.instagramUrl,
    tiktokUrl: cleanString(input.tiktokUrl) || inferred.tiktokUrl,
    services: matchedServices,
    rawServices: [...new Set(enrichedRawServices)],
    summary: cleanString(input.summary) || "Admin draft created from stylist intake.",
    confidence: bookingServiceCheck.confidence === "medium" ? 0.82 : matchedServices.length > 0 ? 0.72 : 0.35,
    warnings: [],
    evidence: buildEvidence(links, enrichedRawServices),
    source: "admin-draft",
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: now,
  });
}

function parseBulkIntake(text = "") {
  const lines = String(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates = [];
  let current = null;

  for (const line of lines) {
    const urls = extractUrls(line);
    if (urls.length) {
      urls.forEach((url, index) => {
        if (index === 0 && current && !current.links.includes(url) && !current.rawServices.length) {
          current.links.push(url);
          current.name ||= inferNameFromUrl(url);
          return;
        }
        current = {
          links: [url],
          name: inferNameFromUrl(url),
          rawServices: [],
          services: [],
        };
        candidates.push(current);
      });
      continue;
    }

    if (!current) {
      continue;
    }

    if (/service|offer|does|speciali[sz]e/i.test(line) || matchServices([line]).length) {
      current.rawServices.push(line);
    } else if (!current.name || current.name === "New stylist") {
      current.name = line;
    } else {
      current.rawServices.push(line);
    }
  }

  return candidates.map((candidate) => ({
    links: candidate.links.join("\n"),
    name: candidate.name,
    rawServices: candidate.rawServices.join("\n"),
    services: matchServices(candidate.rawServices),
  }));
}

function extractUrls(value) {
  return String(value).match(/https?:\/\/[^\s)]+/g) || [];
}

async function generateDiscoverySuggestions() {
  const index = await readAdminSalonIndex();
  const existingKeys = new Set(
    index.salons.flatMap((salon) => [salon.instagramUrl, salon.bookingUrl, salon.websiteUrl, salon.name].filter(Boolean).map(normalizeDiscoveryKey)),
  );
  const popularServices = countTopValues(index.salons.flatMap((salon) => normalizeServices(salon.services || []))).slice(0, 8);
  const popularAreas = countTopValues(index.salons.map((salon) => salon.areaId).filter(Boolean)).slice(0, 6);
  const suggestions = [];

  for (const service of popularServices) {
    for (const areaId of popularAreas.slice(0, 3)) {
      const areaLabel = areaLabelFor(areaId);
      const query = `${service} ${areaLabel || "London"} hair stylist booking`;
      const sourceUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      const id = slugify(`search-${query}`);
      if (existingKeys.has(normalizeDiscoveryKey(sourceUrl))) {
        continue;
      }
      suggestions.push({
        id,
        name: `Search lead: ${service} in ${areaLabel || areaId}`,
        status: "suggested",
        confidence: suggestions.length < 6 ? "high" : "medium",
        sourceUrl,
        areaId,
        areaLabel,
        services: [service],
        reason: `Generated from common ROW K pattern: ${service} listings in ${areaLabel || areaId}.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return suggestions.slice(0, 24);
}

function countTopValues(values) {
  const counts = new Map();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([value]) => value);
}

async function readAdminSalonIndex() {
  const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual", updatedAt: null, count: 0 }, salons: [] });
  const salons = (manualIndex.salons || [])
    .map((salon, addedIndex) => ({
      ...salon,
      addedIndex,
      services: normalizeServices(salon.services || []),
    }))
    .sort(compareRecentlyAdded);

  return {
    meta: {
      source: "manual",
      updatedAt: manualIndex.meta?.updatedAt ?? null,
      count: salons.length,
    },
    salons,
  };
}

function compareRecentlyAdded(left, right) {
  return (right.addedIndex ?? 0) - (left.addedIndex ?? 0) || compareSalons(left, right);
}

function compareSalons(left, right) {
  const leftName = String(left.name || "");
  const rightName = String(right.name || "");
  const leftStartsWithDigit = /^\d/.test(leftName);
  const rightStartsWithDigit = /^\d/.test(rightName);

  if (leftStartsWithDigit !== rightStartsWithDigit) {
    return leftStartsWithDigit ? 1 : -1;
  }

  return leftName.localeCompare(rightName);
}

function normalizeDiscoveryKey(value) {
  return String(value || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").trim();
}

function sanitizeDraftUpdate(input) {
  const links = normalizeLines(input.links);
  const rawServices = normalizeLines(input.rawServices);
  const services = matchServices(toArray(input.services));
  const inferred = inferFromLinks(links);
  const areaIds = normalizeAreaIds(input.areaIds?.length ? input.areaIds : input.areaId ? [input.areaId] : []);
  const areaLabel = cleanString(input.areaLabel) || areaLabelForIds(areaIds);

  return {
    ...(input.status ? { status: cleanString(input.status) } : {}),
    name: cleanString(input.name),
    areaId: areaIds[0] || "",
    areaIds,
    areaLabel,
    neighbourhood: cleanString(input.neighbourhood) || areaLabel,
    postcode: cleanString(input.postcode),
    bookingPlatform: cleanString(input.bookingPlatform) || inferred.bookingPlatform,
    bookingUrl: cleanString(input.bookingUrl) || inferred.bookingUrl,
    websiteUrl: cleanString(input.websiteUrl) || inferred.websiteUrl,
    instagramUrl: cleanString(input.instagramUrl) || inferred.instagramUrl,
    tiktokUrl: cleanString(input.tiktokUrl) || inferred.tiktokUrl,
    services,
    rawServices,
    hijabiFriendly: input.hijabiFriendly === true,
    canBraidWithoutGel: input.canBraidWithoutGel === true,
    summary: cleanString(input.summary),
    warnings: toArray(input.warnings),
    evidence: toArray(input.evidence),
  };
}

function publishedSalonToDraft(salon, fallbackDate = new Date().toISOString()) {
  return {
    id: salon.id,
    status: "approved",
    name: salon.name || "",
    areaId: salon.areaId || "",
    areaIds: Array.isArray(salon.areaIds) ? salon.areaIds : salon.areaId ? [salon.areaId] : [],
    areaLabel: salon.areaLabel || "",
    neighbourhood: salon.neighbourhood || "",
    postcode: salon.postcode || "",
    bookingPlatform: salon.bookingPlatform || "",
    bookingUrl: salon.bookingUrl || "",
    websiteUrl: salon.websiteUrl || "",
    instagramUrl: salon.instagramUrl || "",
    tiktokUrl: salon.tiktokUrl || "",
    services: Array.isArray(salon.services) ? salon.services : [],
    rawServices: [],
    hijabiFriendly: salon.hijabiFriendly === true,
    canBraidWithoutGel: salon.canBraidWithoutGel === true,
    summary: salon.summary || "",
    warnings: [],
    evidence: Array.isArray(salon.evidence) ? salon.evidence : [],
    createdAt: salon.createdAt || fallbackDate,
    updatedAt: salon.updatedAt || fallbackDate,
  };
}

function validateApprovableDraft(draft) {
  if (!draft.name?.trim()) {
    return "Add a stylist or salon name before approving.";
  }
  if (!normalizeAreaIds(draft.areaIds?.length ? draft.areaIds : draft.areaId ? [draft.areaId] : []).length) {
    return "Choose a location before approving.";
  }
  if (!draft.bookingUrl?.trim() && !draft.instagramUrl?.trim() && !draft.websiteUrl?.trim()) {
    return "Add at least one public link before approving.";
  }
  if (!Array.isArray(draft.services) || draft.services.length === 0) {
    return "Select at least one matched service before approving.";
  }
  return "";
}

function normalizeDraftState(draft) {
  const warnings = [];
  if (!hasDraftBookingLink(draft)) {
    warnings.push("No booking link identified yet.");
  }
  if (!Array.isArray(draft.services) || draft.services.length === 0) {
    warnings.push("No services matched yet.");
  }

  const areaIds = normalizeAreaIds(draft.areaIds?.length ? draft.areaIds : draft.areaId ? [draft.areaId] : []);
  const areaLabel = draft.areaLabel || areaLabelForIds(areaIds);

  return {
    ...draft,
    areaId: areaIds[0] || "",
    areaIds,
    areaLabel,
    status: warnings.length ? "needs_review" : "ready_to_approve",
    warnings,
  };
}

function hasDraftBookingLink(draft) {
  return Boolean(draft.bookingUrl?.trim() || isBookingLikeUrl(draft.websiteUrl || ""));
}

function draftToSalon(draft, existingIds) {
  const id = uniqueSlug(draft.name, existingIds);
  const areaIds = normalizeAreaIds(draft.areaIds?.length ? draft.areaIds : draft.areaId ? [draft.areaId] : []);
  const primaryAreaId = areaIds[0] || draft.areaId;
  const areaLabel = draft.areaLabel || areaLabelForIds(areaIds) || areaLabelFor(primaryAreaId);
  return {
    id,
    name: draft.name.trim(),
    areaId: primaryAreaId,
    ...(areaIds.length > 1 ? { areaIds } : {}),
    areaLabel,
    neighbourhood: draft.neighbourhood || areaLabel || "",
    postcode: draft.postcode || "",
    bookingPlatform: draft.bookingPlatform || platformFromUrl(draft.bookingUrl) || "Direct",
    bookingUrl: draft.bookingUrl || draft.websiteUrl || draft.instagramUrl,
    websiteUrl: draft.websiteUrl || draft.bookingUrl || "",
    instagramUrl: draft.instagramUrl || "",
    services: normalizeServices(draft.services),
    ...(draft.hijabiFriendly === true ? { hijabiFriendly: true } : {}),
    ...(draft.canBraidWithoutGel === true ? { canBraidWithoutGel: true } : {}),
    summary: draft.summary || "Admin-approved stylist entry.",
    source: "manual",
    evidence: draft.evidence?.length ? draft.evidence : ["Approved through ROW K admin intake."],
  };
}

function inferFromLinks(links) {
  const result = {
    bookingPlatform: "",
    bookingUrl: "",
    websiteUrl: "",
    instagramUrl: "",
    tiktokUrl: "",
  };

  for (const link of links) {
    const lower = link.toLowerCase();
    if (lower.includes("instagram.com")) {
      result.instagramUrl ||= link;
      continue;
    }
    if (lower.includes("tiktok.com")) {
      result.tiktokUrl ||= link;
      continue;
    }

    const platform = platformFromUrl(link);
    if ((platform || isBookingLikeUrl(link)) && !result.bookingUrl) {
      result.bookingUrl = link;
      result.bookingPlatform = platform || "Direct website";
      continue;
    }

    result.websiteUrl ||= link;
  }

  return result;
}

function platformFromUrl(url = "") {
  const lower = url.toLowerCase();
  return bookingPlatformMatchers.find(([needle]) => lower.includes(needle))?.[1] || "";
}

function isBookingLikeUrl(url = "") {
  try {
    const parsed = new URL(url);
    const text = `${parsed.pathname} ${parsed.search} ${parsed.hash}`.toLowerCase();
    return /\b(book|booking|appointments?|schedule|calendar|reserve|reservation)\b/.test(text);
  } catch {
    return false;
  }
}

export function matchServices(values) {
  const allKnown = new Set(canonicalServices);
  const knownByLowercase = new Map(canonicalServices.map((service) => [service.toLowerCase(), service]));
  const aliasesByLowercase = new Map([
    ...Object.entries(serviceAliases).map(([alias, service]) => [alias.toLowerCase(), service]),
    ...Object.entries(intakeServiceAliases),
  ]);
  const normalized = values.flatMap((value) =>
    String(value || "")
      .split(/\n|,/)
      .map((part) => part.trim())
      .filter(Boolean),
  );

  return normalizeServices(
    normalized
      .flatMap((service, index) => {
        const lower = service.toLowerCase();
        const context = buildServiceLineContext(normalized, index);
        if (hasStyleRemovalInstructionContext(context.nearby)) {
          return [];
        }
        if (hasColourSignal(context.line) && hasWigPieceColourContext(context)) {
          return ["Wig colour"];
        }
        if (hasShampooBlowdryContext(context.nearby)) {
          return ["Wash & blowdry"];
        }
        if (hasCornrowsWithExtensionContext(context)) {
          return ["Feed-in braids"];
        }
        const unitContextServices = getUnitContextServices(context);
        if (unitContextServices.length) {
          return unitContextServices;
        }
        const exact = serviceAliases[service] ?? knownByLowercase.get(lower) ?? aliasesByLowercase.get(lower);
        if (exact && allKnown.has(exact)) {
          return shouldSuppressServiceForSpecificContext(exact, context) || isServiceNegatedInText(lower, exact) ? [] : [exact];
        }

        const ruleMatches = matchServicesByRule(lower);
        if (ruleMatches.length) {
          const filteredMatches = ruleMatches.filter((match) => !shouldSuppressServiceForSpecificContext(match, context) && !isServiceNegatedInText(lower, match));
          if (filteredMatches.length === 0 && ruleMatches.some((match) => isNaturalHairColourService(match)) && hasWigPieceColourContext(context)) {
            return ["Wig colour"];
          }
          return filteredMatches;
        }

        const strongMatch = canonicalServices.find((candidate) => isStrongServiceMatch(lower, candidate.toLowerCase()));
        return strongMatch && !shouldSuppressServiceForSpecificContext(strongMatch, context) && !isServiceNegatedInText(lower, strongMatch) ? strongMatch : [];
      })
      .filter(Boolean),
  );
}

function buildServiceLineContext(lines, index) {
  const line = lines[index] || "";
  const previousTwo = lines[index - 2] || "";
  const previous = lines[index - 1] || "";
  const next = lines[index + 1] || "";
  const nextTwo = lines[index + 2] || "";
  const nearby = [previousTwo, previous, line, next, nextTwo].join(" ");

  return {
    line: normalizeServiceText(line),
    nearby: normalizeServiceText(nearby),
  };
}

function shouldSuppressNaturalColourForWigContext(service, context) {
  return isNaturalHairColourService(service) && hasWigPieceColourContext(context);
}

function getUnitContextServices(context) {
  const hasUnitTitle = /\b(frontal|closure|ready[\s-]*made|customi[sz]ed|custom\s+mini\s+frontal)\s+unit\b/.test(context.line);
  if (!hasUnitTitle) {
    return [];
  }

  const services = ["Wig install (frontal / closure)"];
  if (/\binstallation\s+of\s+the\s+wig\b|\bwig\b.*\b(install|installation|instal|application|fit|fitting)\b/.test(context.nearby)) {
    services.push("Wig install (frontal / closure)");
  }
  if (/\bconstruction\s+of\s+the\s+wig\b|\bconstruction\b|\bcustomi[sz]ed\b|\bcustom\b.*\bunit\b|\bcustom\s+mini\s+frontal\b/.test(context.nearby)) {
    services.push("Custom wig");
  }

  return services;
}

function shouldSuppressServiceForSpecificContext(service, context) {
  return shouldSuppressNaturalColourForWigContext(service, context) || shouldSuppressGenericWigInstall(service, context) || shouldSuppressSewInForWigContext(service, context) || shouldSuppressTraditionalSewInForTrackContext(service, context) || shouldSuppressFeedInForHalfSewInContext(service, context) || shouldSuppressFeedInForNaturalCornrowsContext(service, context) || shouldSuppressSleekPonytailForFrontalContext(service, context) || shouldSuppressPixieStylingForInstallContext(service, context) || shouldSuppressNaturalHairEducationForVagueContext(service, context) || shouldSuppressCustomWigForFactoryMadeContext(service, context) || shouldSuppressTracksForTapeHybridContext(service, context) || shouldSuppressTapeInsForTrackHybridContext(service, context) || shouldSuppressWashBlowdryForPrepInstructions(service, context) || shouldSuppressWigCornrowsForPrepInstructions(service, context) || shouldSuppressStitchBraidsForBohoKnotlessContext(service, context) || shouldSuppressLocSubtypeForStarterContext(service, context) || shouldSuppressTwistsForGenericExtensionsContext(service, context) || shouldSuppressKeratinTreatmentForTipContext(service, context);
}

function shouldSuppressGenericWigInstall(service, context) {
  if (service !== "Wig install (frontal / closure)") {
    return false;
  }

  const hasSpecificUPartContext = /\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b.*\b(wig|install|installation)\b|\b(wig|install|installation)\b.*\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b/.test(context.line);
  const hasWigCornrowsContext = /\bcornrows?\b.*\bwig\s+installation\b|\bwig\s+installation\b.*\bcornrows?\b/.test(context.line);
  const hasFrontalClosureContext = /\b(frontal|closure|lace|glueless)\b/.test(context.line);
  const hasConstructionContext = /\b(construction|construct|making|handmade)\b/.test(context.line);
  const hasInstallContext = /\b(install|installation|instal|fit|fitting|application|glueless)\b/.test(context.line);
  return hasWigCornrowsContext || (hasSpecificUPartContext && !hasFrontalClosureContext) || (hasConstructionContext && !hasInstallContext);
}

function shouldSuppressSewInForWigContext(service, context) {
  if (service !== "Frontal sew-in" && service !== "Closure sew-in") {
    return false;
  }

  const hasWigInstallContext = (/\b(wig|unit)\b/.test(context.line) || /\b(lace\s+)?(frontal|closure)\s+(install|installation|instal)\b/.test(context.line)) && /\b(install|installation|instal|fit|fitting|application)\b/.test(context.line);
  const hasConstructionContext = /\b(construction|construct|making|handmade|custom)\b/.test(context.line);
  const hasSewInContext = /\b(sew\s*in|sewin|weave)\b/.test(context.line);
  return (hasWigInstallContext || hasConstructionContext) && !hasSewInContext;
}

function shouldSuppressTraditionalSewInForTrackContext(service, context) {
  if (service !== "Traditional sew-in / leave out") {
    return false;
  }

  return (/\b(row|rows|line|track|tracks)\b/.test(context.line) && /\b(sew\s*in|sewin|weave|install|installation)\b/.test(context.line)) || hasHalfBraidsHalfSewInContext(context.line);
}

function shouldSuppressPixieStylingForInstallContext(service, context) {
  if (service !== "Pixie / finger waves") {
    return false;
  }

  return /\bpixie\b/.test(context.line) && /\b(wig|weave|sew\s*in|sewin|install|installation)\b/.test(context.line);
}

function shouldSuppressFeedInForHalfSewInContext(service, context) {
  if (service !== "Feed-in braids") {
    return false;
  }

  return hasHalfBraidsHalfSewInContext(context.line);
}

function shouldSuppressFeedInForNaturalCornrowsContext(service, context) {
  if (service !== "Feed-in braids") {
    return false;
  }

  const hasCornrows = /\bcornrows?\b/.test(context.line);
  const hasFeedInCue = /\bfeed[\s-]*ins?\b|\ball\s+back\b|\bbraids?\s+going\s+back\b|\b(extension|extensions|pre\s*pull(ed)?|braiding\s+hair)\b/.test(context.nearby);
  const hasNoExtensionCue = /\b(without|no)\s+extensions?\b/.test(context.nearby);
  return hasCornrows && (!hasFeedInCue || hasNoExtensionCue);
}

function shouldSuppressSleekPonytailForFrontalContext(service, context) {
  if (service !== "Sleek ponytail / bun") {
    return false;
  }

  return hasFrontalPonytailContext(context.line) || hasBraidedPonytailContext(context.line);
}

function shouldSuppressNaturalHairEducationForVagueContext(service, context) {
  if (service !== "Natural hair education") {
    return false;
  }

  return !hasNaturalHairEducationContext(context.line);
}

function shouldSuppressCustomWigForFactoryMadeContext(service, context) {
  if (service !== "Custom wig") {
    return false;
  }

  return /\b(factory\s+made|pre\s*made|premade|ready\s*made|raw\s+pre\s*made)\b/.test(context.line);
}

function shouldSuppressTracksForTapeHybridContext(service, context) {
  if (service !== "Tracks (+ Silk press) / Partial / Invisible sew-in") {
    return false;
  }

  return /\btracks?\b.*\btapes?\b.*\bhybrid\b|\bhybrid\b.*\btracks?\b.*\btapes?\b/.test(context.line);
}

function shouldSuppressTapeInsForTrackHybridContext(service, context) {
  if (service !== "Tape ins") {
    return false;
  }

  return /\btracks?\b.*\btapes?\b.*\bhybrid\b|\bhybrid\b.*\btracks?\b.*\btapes?\b/.test(context.line);
}

function shouldSuppressWashBlowdryForPrepInstructions(service, context) {
  if (service !== "Wash & blowdry") {
    return false;
  }

  return /\b(arrive|come|please|note|recommended)\b.*\b(freshly\s+washed|clean|product\s+free|product-free)\b/.test(context.line) && !/\bblow\s*dry|blowdry|blowout\b/.test(context.line);
}

function shouldSuppressWigCornrowsForPrepInstructions(service, context) {
  if (service !== "Wig cornrows") {
    return false;
  }

  return hasStyleRemovalInstructionContext(context.nearby) || hasCornrowsWithExtensionContext(context);
}

function shouldSuppressStitchBraidsForBohoKnotlessContext(service, context) {
  if (service !== "Stitch braids") {
    return false;
  }

  return /\b(knotless|boho|goddess)\b/.test(context.line) && !/\bstitch\b/.test(context.line);
}

function shouldSuppressLocSubtypeForStarterContext(service, context) {
  if (service !== "Butterfly locs" && service !== "Faux locs") {
    return false;
  }

  return /\bstarter\s+locs?\b|\bloc\s+start\b/.test(context.line);
}

function shouldSuppressTwistsForGenericExtensionsContext(service, context) {
  if (service !== "Twists (with extensions)") {
    return false;
  }

  return /\bextensions?\b/.test(context.line) && !/\btwists?\b|\b(passion|marley|senegalese|island|kinky|rope)\b/.test(context.line);
}

function shouldSuppressKeratinTreatmentForTipContext(service, context) {
  if (service !== "Keratin treatment") {
    return false;
  }

  return /\bkeratin\s+(tips?|bonds?|extensions?)\b/.test(context.line);
}

function isNaturalHairColourService(service) {
  return service === "Full head colour" || service === "Balayage" || service === "Highlights";
}

function hasWigPieceColourContext(context) {
  const wigPiecePattern = /\b(wig|wigs|unit|units|bundle|bundles|extensions?|frontal|closure|lace|lace\s+system|weft|wefts)\b/;
  const wigOnlyColourPattern = /\b613\b|\bnon[\s-]*contact\b/;

  return (
    (hasColourSignal(context.line) && (wigPiecePattern.test(context.line) || wigOnlyColourPattern.test(context.line))) ||
    (hasColourSignal(context.nearby) && (wigPiecePattern.test(context.nearby) || wigOnlyColourPattern.test(context.nearby)) && (hasColourSectionCue(context.nearby) || wigOnlyColourPattern.test(context.nearby)))
  );
}

function hasColourSignal(text) {
  return /\b(colou?r|colou?ring|highlight|highlights|lowlight|lowlights|balayage|tone|toning|tint|dye|bleach|rooting|root)\b/.test(text);
}

function hasColourSectionCue(text) {
  return /\b(colour services|color services|custom colour|custom color|colouring service|coloring service)\b/.test(text);
}

function hasHalfBraidsHalfSewInContext(text) {
  return /\bhalf\b.*\b(feed\s*in|feed-in|braids?|cornrows?)\b.*\b(weave|sew[\s-]*in|sewin)\b/.test(text) || /\bhalf\b.*\b(weave|sew[\s-]*in|sewin)\b.*\b(feed\s*in|feed-in|braids?|cornrows?)\b/.test(text);
}

function hasFrontalPonytailContext(text) {
  return /\bfrontal\b.*\b(pony|ponytail|bun|updo|up\s*do)\b/.test(text) || /\b(pony|ponytail|bun|updo|up\s*do)\b.*\bfrontal\b/.test(text);
}

function hasNaturalHairEducationContext(text) {
  return /\b(afro|natural|curly|curl|hair)\b.*\beducation\b|\beducation\b.*\b(afro|natural|curly|curl|hair)\b|\b(hair|curl|styling)\b.*\btutorial\b|\btutorial\b.*\b(hair|curl|styling)\b|\btrichology\b|\bhair\s+health\b.*\b(assessment|plan|growth|consultation)\b|\bgrowth\s+plan\b|\bconsultation\b.*\bnatural\b|\bnatural\s+hair\b.*\b(class|education|consultation)\b|\bcurl\s+makeover\b.*\b(hands?\s*on|tutorial|styling)\b/.test(text);
}

function hasBraidedPonytailContext(text) {
  return /\b(braided?|braids?|feed\s*in|feed-in|cornrows?)\b.*\b(pony|ponytail)\b/.test(text) || /\b(pony|ponytail)\b.*\b(braided?|braids?|feed\s*in|feed-in|cornrows?)\b/.test(text);
}

function hasCornrowsWithExtensionContext(context) {
  return /\bcornrows?\b/.test(context.line) && /\b(extension|extensions|pre\s*pull(ed)?|braiding\s+hair)\b/.test(context.nearby) && !/\b(without|no)\s+extensions?\b/.test(context.nearby);
}

function hasStyleRemovalInstructionContext(text) {
  return /\b(please\s+)?ensure\b.*\b(hair|styles?)\b.*\b(free|removed?|without|not\s+in)\b.*\b(braids?|cornrows?|sew[\s-]*ins?|weaves?)\b/.test(text) || /\b(hair|styles?)\b.*\b(free|removed?|without|not\s+in)\b.*\b(braids?|cornrows?|sew[\s-]*ins?|weaves?)\b/.test(text);
}

function hasShampooBlowdryContext(text) {
  return /\b(shampoo|wash|washing)\b.*\b(blow\s*dry|blowdry|blowout|blow\s*drying)\b|\b(blow\s*dry|blowdry|blowout|blow\s*drying)\b.*\b(shampoo|wash|washing)\b/.test(text);
}

function matchServicesByRule(input) {
  const normalized = normalizeServiceText(input);

  return serviceRuleMatchers
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(normalized)))
    .map(([service]) => service);
}

function isStrongServiceMatch(input, candidate) {
  const normalizedInput = normalizeServiceText(input);
  const normalizedCandidate = normalizeServiceText(candidate);

  if (normalizedInput.length < 8) {
    return false;
  }

  return normalizedInput.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedInput);
}

function isServiceNegatedInText(input, service) {
  const normalizedInput = normalizeServiceText(input);
  const hints = serviceHintsForNegation(service);

  return hints.some((hint) => {
    const normalizedHint = normalizeServiceText(hint);
    if (!normalizedHint || !normalizedInput.includes(normalizedHint)) {
      return false;
    }

    return isNegatedPhrase(normalizedInput, normalizedHint);
  });
}

function serviceHintsForNegation(service) {
  const aliases = [
    ...Object.entries(serviceAliases)
      .filter(([, value]) => value === service)
      .map(([alias]) => alias),
    ...Object.entries(intakeServiceAliases)
      .filter(([, value]) => value === service)
      .map(([alias]) => alias),
  ];

  return [...new Set([service, ...(serviceNegationHints[service] || []), ...aliases])];
}

function isNegatedPhrase(text, phrase) {
  const escapedPhrase = escapeRegExp(phrase).replace(/\\ /g, "\\s+");
  const beforeNegation = new RegExp(
    `\\b(?:no|not|without|never|don\\s*t|dont|doesn\\s*t|doesnt|do\\s+not|does\\s+not|not\\s+currently|no\\s+longer|don\\s*t\\s+currently|do\\s+not\\s+currently)\\b(?:\\s+\\w+){0,6}\\s+${escapedPhrase}\\b`,
    "i",
  );
  const afterNegation = new RegExp(
    `\\b${escapedPhrase}\\b(?:\\s+\\w+){0,6}\\s+\\b(?:not\\s+included|isn\\s*t\\s+included|isnt\\s+included|not\\s+offered|not\\s+available|unavailable|not\\s+provided)\\b`,
    "i",
  );

  return (beforeNegation.test(text) && !hasPositiveQualifierBetweenNegationAndPhrase(text, phrase)) || (afterNegation.test(text) && !hasIncludedHairQualifier(text));
}

function hasPositiveQualifierBetweenNegationAndPhrase(text, phrase) {
  const wordsBetween = `(?:\\s+\\w+){0,6}\\s+`;
  const escapedPhrase = escapeRegExp(phrase).replace(/\\ /g, "\\s+");
  const pattern = new RegExp(
    `\\b(?:no|not|without|never|don\\s*t|dont|doesn\\s*t|doesnt|do\\s+not|does\\s+not|not\\s+currently|no\\s+longer|don\\s*t\\s+currently|do\\s+not\\s+currently)\\b(${wordsBetween})${escapedPhrase}\\b`,
    "i",
  );
  const between = text.match(pattern)?.[1] || "";

  return /\b(only|except|but)\b/i.test(between);
}

function hasIncludedHairQualifier(text) {
  return /\b(hair|extensions?|bundles?|wig|lace|closure|frontal)\s+(?:is\s+|isn\s*t\s+|isnt\s+)?not\s+included\b/i.test(text);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeServiceText(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function inferAreaIdFromText(value = "") {
  const text = normalizeServiceText(String(value).toLowerCase());
  const areaPatterns = [
    ["essex", /\b(essex|southend|westcliff|romford|ilford|dagenham|barking|grays|basildon|chelmsford)\b/],
    ["kent", /\b(kent|chatham|dartford|gravesend|gillingham|maidstone|bromley)\b/],
    ["croydon", /\bcroydon\b/],
    ["south-east", /\b(south\s*east|se\s*london|peckham|lewisham|greenwich|woolwich|deptford|catford|brixton)\b/],
    ["south-west", /\b(south\s*west|sw\s*london|tooting|wandsworth|clapham|putney|mitcham|streatham)\b/],
    ["north-west", /\b(north\s*west|nw\s*london|harlesden|wembley|kilburn|camden|brent)\b/],
    ["north", /\b(north\s*london|enfield|tottenham|finsbury|wood\s*green|islington)\b/],
    ["east", /\b(east\s*london|hackney|stratford|leyton|bow|newham|tower\s*hamlets)\b/],
    ["west", /\b(west\s*london|ealing|acton|hammersmith|hayes|uxbridge|shepherds\s*bush)\b/],
    ["central", /\b(central\s*london|soho|westminster|marylebone|fitzrovia|mayfair)\b/],
    ["all-london", /\blondon\b/],
  ];

  return areaPatterns.find(([, pattern]) => pattern.test(text))?.[0] || "";
}

function buildEvidence(links, rawServices) {
  const evidence = links.map((link) => `Submitted link: ${link}`);
  if (rawServices.length) {
    evidence.push("Raw services provided during admin intake.");
  }
  return evidence.length ? evidence : ["Created through ROW K admin intake."];
}

function normalizeLines(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return normalizeLines(value);
}

function cleanString(value) {
  return String(value || "").trim();
}

function inferNameFromUrl(url = "") {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return titleCase(parts[0] || parsed.hostname.replace(/^www\./, "").split(".")[0]);
  } catch {
    return "";
  }
}

function areaLabelFor(areaId = "") {
  return regionOptions.find((region) => region.id === areaId)?.label || "";
}

function normalizeAreaIds(areaIds = []) {
  const validAreaIds = new Set(regionOptions.map((region) => region.id));
  return [...new Set(toArray(areaIds).map(cleanString).filter((areaId) => areaId && validAreaIds.has(areaId)))];
}

function areaLabelForIds(areaIds = []) {
  return normalizeAreaIds(areaIds).map(areaLabelFor).filter(Boolean).join(" / ");
}

function makeUniqueDraftId(name) {
  return `${slugify(name)}-${Date.now().toString(36)}`;
}

function uniqueSlug(name, existingIds) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;

  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function slugify(value) {
  return (
    String(value || "stylist")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "stylist"
  );
}

function titleCase(value) {
  return value
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}
