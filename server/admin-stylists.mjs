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
const githubBackedJsonPaths = new Set(["data/manual-salons.json", "data/stylist-drafts.json", "data/discovery-suggestions.json", "data/freshness-checks.json"]);

const regionOptions = [
  { id: "all-london", label: "London" },
  { id: "central", label: "Central London" },
  { id: "north", label: "North London" },
  { id: "north-west", label: "North west London" },
  { id: "east", label: "East London" },
  { id: "south-east", label: "South east London" },
  { id: "south-west", label: "South west London" },
  { id: "west", label: "West London" },
  { id: "croydon", label: "Croydon" },
  { id: "kent", label: "Kent" },
  { id: "essex", label: "Essex" },
  { id: "mobile", label: "Mobile / home service" },
];
const londonParentAreaId = "all-london";
const londonChildAreaIds = new Set(["central", "north", "north-west", "east", "south-east", "south-west", "west", "croydon"]);

const bookingPlatformMatchers = [
  ["fresha.com", "Fresha"],
  ["booksy.com", "Booksy"],
  ["setmore.com", "Setmore"],
  ["as.me", "Acuity"],
  ["acuityscheduling.com", "Acuity"],
  ["phorest.com", "Phorest"],
  ["vagaro.com", "Vagaro"],
  ["gettimely.com", "Timely"],
  ["square.site", "Square"],
  ["squareup.com", "Square"],
  ["zenoti.com", "Zenoti"],
  ["getslick.com", "GetSlick"],
  ["slick.fyi", "GetSlick"],
  ["tressly.com", "Tressly"],
  ["jena", "Jena"],
  ["treatwell.co.uk", "Treatwell"],
  ["glossgenius.com", "GlossGenius"],
  ["styleseat.com", "StyleSeat"],
  ["calendly.com", "Calendly"],
];

const browserUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
let nextInstagramProfileProbeAt = 0;
let priceCheckBrowserPromise = null;
const canonicalServices = [...new Set(Object.values(categoryMap).flat().filter(Boolean))].sort((left, right) => left.localeCompare(right));
const priceBands = new Set(["£", "££", "£££", "££££"]);
const priceConfidences = new Set(["high", "medium", "low", "manual", "unknown"]);

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
  ["Wig colouring / bundle colouring", [/\b(wig|extensions?|bundle|bundles|frontal|closure|lace\s+system)\b.*\b(colou?r|dye|ton(e|ing)|bleach|highlight|custom colou?r)\b/, /\b(colou?r|dye|ton(e|ing)|bleach|highlight|custom colou?r)\b.*\b(wig|extensions?|bundle|bundles|frontal|closure|lace\s+system)\b/, /\b613\b.*\b(colou?r|dye|ton(e|ing)|bleach|highlight|bright)\b/, /\b(colou?r|dye|ton(e|ing)|bleach|highlight|bright)\b.*\b613\b/, /\bnon[\s-]*contact\b.*\b(colou?r|colou?ring|dye|ton(e|ing)|bleach|highlight)\b/]],
  ["Frontal ponytail / bun", [/\bfrontal\b.*\b(pony|ponytail|bun)\b/, /\b(pony|ponytail|bun)\b.*\bfrontal\b/]],
  ["Half braids, half sew-in", [/\bhalf\b.*\b(braid|braids|feed\s*in|feed-in|cornrows?)\b.*\b(weave|sew[\s-]*in|sewin)\b/, /\bhalf\b.*\b(weave|sew[\s-]*in|sewin)\b.*\b(braid|braids|feed\s*in|feed-in|cornrows?)\b/, /\bhalf\s+braid\b/, /\bhalf\s+weave\b/]],
  ["Wig install (frontal / closure)", [/\bwig\b.*\b(install|instal|installation|application|fit|fitting)\b/, /\b(glueless|lace)\s+wig\b/, /\bfrontal\s+wig\b/, /\bclosure\s+wig\b/, /\b(frontal|closure|ready[\s-]*made)\s+unit\b/, /\bunit\b.*\b(install|instal|installation|application|fit|fitting)\b/, /\b(lace\s+)?frontal\s+installation\b/, /\b(lace\s+)?closure\s+installation\b/]],
  ["U-part wig install", [/\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b.*\b(wig|install|installation)\b/, /\b(wig|install|installation)\b.*\b(u[\s-]*part|v[\s-]*part|u[\s/-]*v[\s-]*part|uvpart)\b/]],
  ["Custom wig", [/\bcustom\b.*\bwig\b/, /\bbespoke\b.*\bwig\b/, /\bcustom\s+handmade\s+wigs?\b/, /\bwig\b.*\b(custom|bespoke|handmade|made|making|construction|unit)\b/, /\bunit\b.*\bcustomi[sz](ing|ation)\b/, /\bcustomi[sz](ing|ation)\b.*\bunit\b/, /\bcustom(?:\s+made)?\b.*\b(frontal|closure)\s+unit\b/, /\bcustom\b.*\bfrontal\s+closure\s+units?\b/, /\bwig\s+(making|construction|customi[sz](ing|ation))\b/, /\bconstruction\s+of\s+(the\s+)?wig\b/, /\bconstruction\b.*\bcustomi[sz](ing|ation)\b/, /\bcustomi[sz](ing|ation)\b.*\bconstruction\b/, /\b(frontal|closure)\b.*\bcustomi[sz](ing|ation)\b/]],
  ["Pixie wig / weave install", [/\bpixie\b.*\b(wig|weave|sew\s*in|sewin|install|making)\b/, /\b(wig|weave|sew\s*in|sewin|making)\b.*\bpixie\b/]],
  ["Closure sew-in", [/\bclosure\b.*\b(sew\s*in|sewin|weave)\b/, /\b(sew\s*in|sewin|weave)\b.*\bclosure\b/, /\bweave\b.*\b(lace\s+)?closure\b/, /\bclosure\b.*\bbehind\s+the\s+hairline\b/]],
  ["Frontal sew-in", [/\bfrontal\b.*\b(sew\s*in|sewin|weave)\b/, /\b(sew\s*in|sewin|weave)\b.*\bfrontal\b/]],
  ["Flipover / Versatile sew-in", [/\bflip\s*over\b/, /\bflipover\b/, /\bversatile\b.*\b(sew\s*in|sewin|weave)\b/, /\bversatile\s+sew\s+in\b/]],
  ["Quick weave", [/\bquick\b.*\bweave\b/, /\bquickweave\b/]],
  ["Hybrid sew in (tapes + sew in)", [/\bhybrid\b.*\b(sew\s*in|sewin|weave)\b/, /\btracks?\b.*\btapes?\b.*\bhybrid\b/, /\bhybrid\b.*\btracks?\b.*\btapes?\b/]],
  ["Sew-in take-down", [/\b(sew\s*in|sewin|weave|tracks?)\b.*\b(take\s*down|takedown|removal|remove)\b/, /\b(take\s*down|takedown|removal|remove)\b.*\b(sew\s*in|sewin|weave|tracks?)\b/]],
  ["Tracks (+ silk press) / partial / invisible sew-in", [/\btracks?\b/, /\bsingle\s+tracks?\s+weave\b/, /\bsingle\s*\/\s*double\s+tracks?\s+weave\b/, /\bindividual\s+sewn\s+on\s+tracks?\b/, /\bpartial\b.*\b(sew\s*in|sewin|weave)\b/, /\binvisible\b.*\b(sew\s*in|sewin|weave|wefts?)\b/, /\b(row|rows|line)\s+(?:of\s+)?(sew\s*in|sewin|weave)\b/, /\b(sew\s*in|sewin|weave)\s+(row|rows|line)\b/, /\bweave\s+on\s+per\s+row\b/, /\bweave\s+tracks?\s*\(?per\s+track\)?\b/, /\bsew[\s-]*in\s+tracks?\b/, /\bper\s+(track|row|line)\b/, /\btrack\s+per\s+row\b/, /\btracks?\s+per\s+(track|row|line|double\s+row)\b/, /\btraditional\s+weave\s+rows?\b/, /^\d+\s+row$/, /\bone\s+row\b/]],
  ["Traditional sew-in / leave out", [/\bleave\s*out\b/, /\b(middle|side)\s+part\b.*\b(sew\s*in|sewin|weave)\b/, /\btraditional\b.*\b(sew\s*in|sewin|weave)\b/, /\b(sew\s*in|sewin)\b/]],
  ["K-tips / invisible strands", [/\bk\s*tips?\b/, /\bk-tips?\b/, /\binvisible\s+strands?\b/, /\bkeratin\s+(tips?|bonds?|extensions?)\b/]],
  ["LA weave", [/\bla\s+weave\b/]],
  ["Tape ins", [/\btape\s*ins?\b/, /\btape-in\b/, /\btapes?\b/, /\btape\s+extensions?\b/]],
  ["Microlinks", [/\bmicro\s*links?\b/, /\bmicrolinks?\b/, /\bi\s*tips?\b/, /\bitips?\b/]],
  ["Clip ins (+ silk press)", [/\bclip\s*ins?\b/, /\bclip-in\b/]],
  ["Boho braids / goddess braids", [/\bboho\b/, /\bgoddess\b/]],
  ["Knotless braids", [/\bknotless\b/]],
  ["Box braids", [/\bbox\b.*\bbraids?\b/]],
  ["Crochet", [/\bcrochet\b/]],
  ["Creative braids (e.g. patewo)", [/\bpatewo\b/, /\bdolly\s+braids?\b/, /\bshuku\b/, /\bkoroba\s+braids?\b/, /\bcreative\b.*\bbraids?\b/]],
  ["Feed-in braids", [/\bfeed\s*in\b/, /\bfeed-in\b/, /\ball\s+back\b.*\b(braids?|cornrows?|feed\s*ins?)\b/, /\b(braids?|cornrows?|feed\s*ins?)\b.*\ball\s+back\b/, /\bbraids?\b.*\bgoing\s+back\b/, /\bgoing\s+back\b.*\bbraids?\b/, /\bcornrows?\b.*\b(extension|extensions|pre\s*pull(ed)?|braiding\s+hair)\b/, /\b(extension|extensions|pre\s*pull(ed)?|braiding\s+hair)\b.*\bcornrows?\b/]],
  ["French curl", [/\bfrench\s+curl\b/]],
  ["Fulani / lemonade braids", [/\bfulani\b/, /\blemonade\b/, /\balicia\s+keys?\s+braids?\b/]],
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
  ["Microlocs / sisterlocs", [/\bmicro\s*locs?\b/, /\bmicrolocs?\b/, /\bsister\s*locs?\b/, /\bsisterlocs?\b/]],
  ["Balayage", [/\bbalayage\b/]],
  ["Highlights", [/\bhigh\s*lights?\b/, /\bhighlights?\b/]],
  ["Full head colour", [/\bfull\s+head\b.*\bcolou?r\b/, /\bpermanent\s+(colou?r|tint)\b/, /\b(colou?r|dye|tint)\b/]],
  ["Bridal", [/\bbridal\b/, /\bwedding\b/]],
  ["Editorial / Session styling", [/\beditorial\b/, /\bsession\s+styling\b/, /\bphotoshoot\b/]],
  ["Keratin treatment", [/\bkeratin\b/]],
  ["Relaxer / texturiser", [/\brelaxer\b/, /\btexturi[sz]er\b/, /\btexturi[sz]ing\b/]],
  ["Texture release", [/\btexture\s+release\b/]],
  ["Japanese straightening", [/\bjapanese\b.*\bstraight(en|ening)\b/, /\bmomoko\b(?:.*\bstraight(en|ening)\b)?/]],
  ["Hair botox", [/\bbotox\b/]],
  ["Olaplex treatment", [/\bolaplex\b/, /\b(repair|bond)\b.*\b(bond|repair|treatment)\b/]],
  ["K-18 treatment", [/\bk\s*18\b/, /\bk-18\b/]],
  ["Moisturising treatment", [/\bmoisturi[sz](ing|e)\b/, /\bmoisture\b/, /\bhydrat(e|ing|ion)\b/, /\bprotein\s*&?\s+moisture\b/, /\bdeep\s+condition(ing)?\b/, /\bsteam\s+treat(ment)?\b/, /\bnatural\s+hair\s+care\b/]],
  ["Japanese head spa", [/\bjapanese\s+head\s+spa\b/, /\bhead\s*spa\b/]],
  ["Scalp detox / treatments", [/\bscalp\b/]],
  ["Curly cut / wash & go", [/\bcurly\s+cut\b/, /\bwash\s*(and|&)?\s*go\b/]],
  ["Wash & blowdry", [/\bwash\b.*\b(blow\s*dry|blowdry|blowout)\b/, /\bshampoo\b.*\b(blow\s*dry|blowdry|blowout)\b/, /\bblow\s*out\b/, /\bblowout\b/]],
  ["Trim / hair cut", [/\btrim\b/, /\bhair\s*cut\b/, /\bhaircut\b/, /\bcut\s+and\s+finish\b/]],
  ["Silk press", [/\bsilk\s+press\b/, /\bsilkpress\b/, /\bpress\s+and\s+curl\b/]],
  ["Twist out / flexi rod", [/\btwist\s*out\b/, /\bflexi\s*rod\b/, /\bflexi-rod\b/, /\bperm\s+rod\b/]],
  ["Wig cornrows", [/\bunder\s*wig\b/, /\bwig\s+(cornrows?|cainrows?)\b/, /\b(cornrows?|cainrows?)\s+for\s+wig\s+installation\b/, /\b(cornrows?|cainrows?)\s+without\s+extensions?\b/, /\bwig\s+cainrows?\b/, /\bcainrows?\b/, /\bcornrows?\b/]],
  ["Healthy hair plans & consultations", [/\bhealthy\s+hair\s+(regimes?|regimens?|plans?|journey|consultations?)\b/, /\bhair\s+growth\s+plans?\b/, /\bhair\s+health\s+plans?\b/]],
  ["Trichology / scalp analysis", [/\btricholog(?:y|ist|ists)\b/, /\bscalp\s+analysis\b/]],
  ["Natural hair coaches / educators", [/\b(afro|natural|curly|curl|hair)\b.*\beducation\b/, /\beducation\b.*\b(afro|natural|curly|curl|hair)\b/, /\b(hair|curl|styling)\b.*\btutorial\b/, /\btutorial\b.*\b(hair|curl|styling)\b/, /\bhair\s+health\b.*\b(assessment|plan|growth|consultation)\b/, /\bgrowth\s+plan\b/, /\bconsultation\b.*\bnatural\b/, /\bnatural\s+hair\b.*\b(class|education|consultation)\b/, /\bcurl\s+makeover\b.*\b(hands?\s*on|tutorial|styling)\b/]],
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
  "Bridal": ["bridal", "wedding"],
  "Editorial / Session styling": ["editorial", "session styling", "photoshoot"],
  "Butterfly locs": ["butterfly locs"],
  "Clip ins (+ silk press)": ["clip ins", "clip in"],
  "Closure sew-in": ["closure sew in", "closure sew-in", "closure sewin", "closure weave", "weave with lace closure", "closure behind the hairline"],
  "Creative braids (e.g. patewo)": ["creative braids", "patewo", "dolly braids", "shuku", "koroba braids"],
  "Crochet": ["crochet"],
  "Curly cut / wash & go": ["curly cut", "wash go", "wash and go"],
  "Custom wig": ["custom wig", "bespoke wig", "custom handmade wig", "custom handmade wigs", "custom made frontal unit", "custom made closure unit", "customised closure unit", "customized closure unit", "custom mini frontal unit", "unit customisation", "unit customization", "wig making", "wig construction", "construction of wig", "construction of the wig", "wig customising", "wig customisation", "wig customization", "construction and customisation", "construction and customization"],
  "Faux locs": ["faux locs", "soft locs"],
  "Feed-in braids": ["feed in", "feed in braids", "all back", "braids going back", "cornrows incl extensions", "cornrows including extensions", "cornrows with extensions", "20 cornrows"],
  "Flipover / Versatile sew-in": ["flipover", "flip over", "versatile sew in", "versatile sewin", "versatile weave"],
  "French curl": ["french curl"],
  "Frontal ponytail / bun": ["frontal ponytail", "frontal pony", "frontal bun"],
  "Frontal sew-in": ["frontal sew in", "frontal sewin", "frontal weave"],
  "Fulani / lemonade braids": ["fulani", "lemonade", "alicia keys braids"],
  "Full head colour": ["full head colour", "full head color", "colour", "color", "dye", "tint"],
  "Hair botox": ["hair botox", "botox"],
  "Healthy hair plans & consultations": ["healthy hair", "healthy hair plan", "healthy hair plans", "healthy hair consultation", "healthy hair consultations", "healthy hair regime", "healthy hair regimes", "healthy hair regimen", "healthy hair journey", "hair growth plan", "hair health plan"],
  "Half braids, half sew-in": ["half braids half sew in", "half braid half weave", "half weave"],
  "Half up half down": ["half up half down"],
  "Highlights": ["highlights", "high lights"],
  "Hybrid sew in (tapes + sew in)": ["hybrid sew in", "hybrid sewin", "hybrid weave"],
  "Japanese straightening": ["japanese straightening"],
  "K-18 treatment": ["k 18", "k18"],
  "K-tips / invisible strands": ["k tips", "invisible strands", "keratin tip", "keratin tips", "keratin bonds"],
  "Keratin treatment": ["keratin"],
  "Knotless braids": ["knotless"],
  "LA weave": ["la weave"],
  "Microbraids / x-small braids": ["micro braids", "microbraids", "x small braids", "xs braids"],
  "Microlinks": ["micro links", "microlinks", "i tips", "itips"],
  "Microlocs / sisterlocs": ["micro locs", "microlocs", "sister locs", "sisterlocs"],
  "Miracle knots": ["miracle knots"],
  "Moisturising treatment": ["moisturising", "moisturizing", "deep condition", "steam treatment", "natural hair care"],
  "Natural hair coaches / educators": ["natural hair education", "natural hair class", "natural hair consultation", "natural hair coach", "natural hair coaches", "educator", "educators"],
  "Trichology / scalp analysis": ["trichologist", "trichologists", "trichology", "scalp analysis"],
  "Olaplex treatment": ["olaplex"],
  "Pixie / finger waves": ["pixie", "finger waves"],
  "Pixie wig / weave install": ["pixie wig", "pixie weave", "pixie install", "pixie cut wig making", "pixie cut wig making styling"],
  "Pre-parting": ["pre parting", "pre part"],
  "Quick weave": ["quick weave", "quickweave"],
  "Relaxer / texturiser": ["relaxer", "texturiser", "texturizer", "texturising", "texturizing"],
  "Retwist": ["retwist", "re twist"],
  "Scalp detox / treatments": ["scalp", "scalp care", "scalp therapy", "scalp treatment", "scalp treatments", "scalp scrub", "scalp detox", "scalp rejuvenation", "scalp renewal", "exfoliating scalp salt scrub"],
  "Sew-in take-down": ["sew in take down", "sew in takedown", "sew in removal", "weave removal", "remove sew in"],
  "Silk press": ["silk press", "silkpress", "press and curl"],
  "Sleek ponytail / bun": ["sleek ponytail", "sleek pony", "sleek bun", "ponytail", "pony tail"],
  "Starter locs": ["starter locs", "start locs", "loc start"],
  "Stitch braids": ["stitch"],
  "Tape ins": ["tape ins", "tape in", "tapes", "tape extensions"],
  "Texture release": ["texture release"],
  "Tracks (+ silk press) / partial / invisible sew-in": ["tracks", "track per row", "per track", "per row", "one row", "individual sewn on track", "individual sewn on tracks", "tracks add on", "tracks add-on", "silk press add on tracks", "silk press add-on tracks", "sew in tracks", "sew-in tracks", "sew-in tracks per line", "row sew in", "rows of sew in", "weave tracks", "weave tracks per track", "weave on per row", "single track weave", "single double track weave", "traditional weave rows", "partial sew in", "partial sewin", "invisible sew in", "invisible weave", "invisible weft", "invisible wefts"],
  "Traditional sew-in / leave out": ["leave out", "traditional sew in", "traditional sewin", "traditional weave", "sew in", "sewin"],
  "Trim / hair cut": ["trim", "hair cut", "haircut", "cut and finish"],
  "Twist out / flexi rod": ["twist out", "flexi rod", "perm rod"],
  "Twists (with extensions)": ["twists with extensions", "passion twists", "marley twists", "senegalese twists", "kinky twists", "rope twists", "island twists", "island twist", "large twist", "large twists"],
  "U-part wig install": ["u part", "u-part", "upart", "u part wig", "u-part wig", "upart wig", "v part", "v-part", "vpart", "v part wig", "v-part wig", "vpart wig", "u vpart", "uvpart", "half wig"],
  "Updo": ["updo", "up do", "pin up", "french roll up", "french roll"],
  "Wash & blowdry": ["wash blowdry", "wash blow dry", "wash and blowdry", "wash and blow dry", "washing blow drying", "washing and blow drying", "shampoo blowdry", "shampoo blow dry", "shampoo and blowdry", "shampoo and blow dry", "blowout"],
  "Japanese head spa": ["japanese head spa", "head spa", "headspa"],
  "Wig colouring / bundle colouring": ["wig colour", "wig color", "wig dye", "colour wig", "color wig", "wig colouring service", "hair bundle colouring service", "lace closure colouring", "lace frontal colouring", "highlights frontal bundles", "highlights bundles closure"],
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
    const pricingUpdate = buildPricingUpdate(update, currentSalon, now);
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
      ...pricingUpdate,
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

  app.delete("/api/admin/stylists/published/:id", requireAdmin, async (req, res) => {
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const salonIndex = manualIndex.salons.findIndex((salon) => salon.id === req.params.id);
    if (salonIndex === -1) {
      return res.status(404).json({ ok: false, message: "Published stylist not found." });
    }

    manualIndex.salons.splice(salonIndex, 1);
    manualIndex.meta = {
      ...manualIndex.meta,
      updatedAt: new Date().toISOString(),
      count: manualIndex.salons.length,
    };
    await writeJson(manualIndexPath, manualIndex);

    res.json({ ok: true, id: req.params.id });
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
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual", count: 0 }, salons: [] });
    const salonsById = new Map((manualIndex.salons || []).map((salon) => [salon.id, salon]));
    const dismissedRecommendations = store.dismissedRecommendations || {};
    const checks = (store.checks || [])
      .map((check) => hydrateFreshnessCheckFromSalon(check, salonsById.get(check.id)))
      .map((check) => applyDismissedRecommendationToCheck(check, dismissedRecommendations[check.id]))
      .filter(hasActionableFreshnessCheck);
    res.json({
      ok: true,
      checks,
      checkedAt: store.meta?.updatedAt ?? null,
      checkedCount: store.meta?.checkedCount ?? 0,
      total: store.meta?.total ?? 0,
      nextOffset: typeof store.meta?.checkedCount === "number" && typeof store.meta?.total === "number" && store.meta.checkedCount < store.meta.total ? store.meta.checkedCount : null,
      meta: store.meta || null,
    });
  });

  app.post("/api/admin/stylists/checks/saved", requireAdmin, async (req, res) => {
    const existingStore = await readFreshnessStore({ meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [], dismissedRecommendations: {} });
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual", count: 0 }, salons: [] });
    const salonsById = new Map((manualIndex.salons || []).map((salon) => [salon.id, salon]));
    const checkedAt = cleanString(req.body?.checkedAt) || new Date().toISOString();
    const dismissedRecommendations = existingStore.dismissedRecommendations || {};
    const checks = (Array.isArray(req.body?.checks) ? req.body.checks : [])
      .map((check) => sanitizeFreshnessCheck(check, check?.id))
      .map((check) => hydrateFreshnessCheckFromSalon(check, salonsById.get(check?.id)))
      .map((check) => applyDismissedRecommendationToCheck(check, dismissedRecommendations[check?.id]))
      .filter(hasActionableFreshnessCheck);
    const checkedCount = Number(req.body?.checkedCount) || 0;
    const total = Number(req.body?.total) || 0;
    const existingChecks = (Array.isArray(existingStore.checks) ? existingStore.checks : [])
      .map((check) => hydrateFreshnessCheckFromSalon(check, salonsById.get(check.id)))
      .map((check) => applyDismissedRecommendationToCheck(check, dismissedRecommendations[check.id]))
      .filter(hasActionableFreshnessCheck);

    if (checks.length === 0 && existingChecks.length > 0 && checkedCount < total) {
      return res.json({
        ok: true,
        ...(existingStore.meta || {}),
        checkedAt: existingStore.meta?.updatedAt ?? null,
        checks: existingChecks,
        preserved: true,
        message: "Preserved previous health check results because the submitted run was incomplete and empty.",
      });
    }

    const payload = {
      meta: {
        source: "freshness-checks",
        updatedAt: checkedAt,
        count: checks.length,
        checkedCount,
        total,
      },
      dismissedRecommendations,
      checks,
    };
    await writeFreshnessStore(payload);
    res.json({ ok: true, ...payload.meta, checkedAt, checks });
  });

  app.get("/api/admin/stylists/checks", requireAdmin, async (req, res) => {
    const index = await readAdminSalonIndex();
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual", updatedAt: null, count: 0 }, salons: [] });
    const checkedAt = new Date().toISOString();
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 50);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const requestedMode = cleanString(req.query.mode);
    const mode = requestedMode === "pricing" || requestedMode === "missing-prices" ? "pricing" : "freshness";
    const candidateSalons = mode === "pricing" ? index.salons : index.salons;
    const batchSalons = candidateSalons.slice(offset, offset + limit);
    const existingStore = await readFreshnessStore({ meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [], dismissedRecommendations: {} });
    const dismissedRecommendations = existingStore.dismissedRecommendations || {};
    const salonsById = new Map((manualIndex.salons || []).map((salon) => [salon.id, salon]));
    const existingReviewChecks = (existingStore.checks || [])
      .map((check) => hydrateFreshnessCheckFromSalon(check, salonsById.get(check.id)))
      .map((check) => applyDismissedRecommendationToCheck(check, dismissedRecommendations[check.id]))
      .filter(hasActionableFreshnessCheck);
    const existingChecksById = new Map((existingStore.checks || []).map((check) => [check.id, check]));
    const checks = await mapWithConcurrency(batchSalons, isHostedRuntime() ? 2 : 6, (salon) => mode === "pricing"
      ? checkPricingFreshness(salon, dismissedRecommendations[salon.id])
      : checkSalonFreshness(salon, dismissedRecommendations[salon.id], existingChecksById.get(salon.id)), {
      delayMs: isHostedRuntime() ? 350 : 0,
    });
    const actionableChecks = checks
      .map((check) => applyDismissedRecommendationToCheck(check, dismissedRecommendations[check.id]))
      .filter(hasActionableFreshnessCheck);
    const autoPricingChanges = mode === "pricing"
      ? checks
        .map((check) => ({ check, update: getAutoPricingUpdate(check.priceCheck) }))
        .filter(({ check, update }) => {
          if (update) {
            return true;
          }
          const salon = manualIndex.salons.find((item) => item.id === check.id);
          if (!salonHasAutoPricing(salon)) {
            return false;
          }
          return check.backfillStatus === "no-price";
        })
      : [];
    if (autoPricingChanges.length) {
      const salonsById = new Map(manualIndex.salons.map((salon, index) => [salon.id, { salon, index }]));
      let changedPricing = false;
      const now = new Date().toISOString();
      autoPricingChanges.forEach(({ check, update }) => {
        const match = salonsById.get(check.id);
        if (!match) {
          return;
        }
        if (!update && salonHasAutoPricing(match.salon)) {
          manualIndex.salons[match.index] = clearSalonPricing(match.salon);
          changedPricing = true;
          return;
        }
        const nextPricing = { ...update, priceUpdatedAt: now };
        if (pricingFieldsEqual(match.salon, nextPricing)) {
          return;
        }
        manualIndex.salons[match.index] = {
          ...match.salon,
          ...nextPricing,
        };
        changedPricing = true;
      });
      if (changedPricing) {
        manualIndex.meta = {
          ...manualIndex.meta,
          updatedAt: now,
          count: manualIndex.salons.length,
        };
        if (isGitHubJsonBacked()) {
          await writeJsonFilesToGitHub([{ path: "data/manual-salons.json", payload: manualIndex }], "Update automated pricing bands");
        } else {
          await tryWriteJson(manualIndexPath, manualIndex);
        }
      }
    }
    const reviewChecks = mode === "pricing"
      ? checks.map((check) => applyDismissedRecommendationToCheck(check, dismissedRecommendations[check.id])).filter(hasVisibleMissingPriceBackfillResult)
      : actionableChecks.map(stripAutoAppliedPriceCheck).filter(hasActionableFreshnessCheck);
    const mergedChecks = offset > 0 ? mergeFreshnessChecks(existingReviewChecks, reviewChecks) : reviewChecks;

    const checkedCount = Math.min(offset + batchSalons.length, candidateSalons.length);
    const persistedChecks = mode === "pricing"
      ? mergedChecks.filter(hasActionableFreshnessCheck)
      : mergedChecks;
    const persisted = await tryWriteJson(freshnessChecksPath, {
      meta: {
        source: "freshness-checks",
        updatedAt: checkedAt,
        count: persistedChecks.length,
        checkedCount,
        total: candidateSalons.length,
        mode,
      },
      dismissedRecommendations,
      checks: persistedChecks,
    });

    res.json({
      ok: true,
      checks: reviewChecks,
      checkedAt,
      mode,
      summary: mode === "pricing" ? summarizeMissingPriceBackfillResults(checks) : null,
      offset,
      limit,
      batchCount: batchSalons.length,
      checkedCount,
      total: candidateSalons.length,
      nextOffset: offset + batchSalons.length < candidateSalons.length ? offset + batchSalons.length : null,
      persisted,
    });
  });

  app.post("/api/admin/stylists/match-services", requireAdmin, async (req, res) => {
    const rawServices = toArray(req.body?.rawServices);
    res.json({ ok: true, services: matchServices(rawServices) });
  });

  app.post("/api/admin/stylists/parse-prices", requireAdmin, async (req, res) => {
    const rawText = cleanString(req.body?.text);
    const priceCheck = parseManualPriceText(rawText);
    res.json({
      ok: true,
      ...priceCheck,
    });
  });

  app.post("/api/admin/stylists/booking-preview", requireAdmin, async (req, res) => {
    const bookingUrl = cleanString(req.body?.bookingUrl);
    const websiteUrl = cleanString(req.body?.websiteUrl);
    const urls = {
      bookingUrl: bookingUrl && !isSocialOnlyUrl(bookingUrl) ? bookingUrl : "",
      websiteUrl: websiteUrl && !isSocialOnlyUrl(websiteUrl) ? websiteUrl : "",
    };

    if (!urls.bookingUrl && !urls.websiteUrl) {
      return res.status(400).json({ ok: false, message: "Add a machine-readable booking or website link first." });
    }

    const [bookingLinkCheck, websiteLinkCheck] = await Promise.all([
      urls.bookingUrl ? checkUrl("booking", urls.bookingUrl, { includeText: true }) : null,
      urls.websiteUrl && urls.websiteUrl !== urls.bookingUrl ? checkUrl("website", urls.websiteUrl, { includeText: true }) : null,
    ]);
    const bookingHtml = bookingLinkCheck?.status === "ok" ? bookingLinkCheck.responseText || "" : "";
    const websiteHtml = websiteLinkCheck?.status === "ok" ? websiteLinkCheck.responseText || "" : "";
    const embeddedBookingSources = await fetchEmbeddedBookingSources([
      { html: bookingHtml, url: urls.bookingUrl },
      { html: websiteHtml, url: urls.websiteUrl },
    ]);
    const enrichedBookingHtml = combineBookingHtml(bookingHtml, embeddedBookingSources);
    const serviceCheck = enrichedBookingHtml ? extractBookingServicesFromHtml(enrichedBookingHtml) : emptyServiceCheck();
    let priceCheck = await extractBestPriceCheck({
      booking: enrichedBookingHtml,
      website: websiteHtml,
      bookingUrl: embeddedBookingSources[0]?.url || urls.bookingUrl,
      websiteUrl: urls.websiteUrl,
      allowAiFallback: true,
    });

    if (priceCheck.confidence === "unknown") {
      priceCheck = await extractDirectSiteFallbackPriceCheck({
        bookingHtml: enrichedBookingHtml,
        websiteHtml,
        bookingUrl: urls.bookingUrl,
        websiteUrl: urls.websiteUrl,
        allowAiFallback: true,
      });
    }

    res.json({
      ok: true,
      linkChecks: [
        bookingLinkCheck,
        websiteLinkCheck,
        ...embeddedBookingSources.map((source) => source.linkCheck),
      ].filter(Boolean).map(stripLinkCheckResponseText),
      serviceCheck,
      priceCheck,
    });
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
    const rejectHijabiFriendly = req.body?.rejectHijabiFriendly === true;
    const locationAreaIds = normalizeAreaIds(Array.isArray(req.body?.areaIds) && req.body.areaIds.length ? req.body.areaIds : req.body?.areaId ? [req.body.areaId] : []);
    const locationAreaLabel = cleanString(req.body?.areaLabel) || areaLabelForIds(locationAreaIds);
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
      ...(locationAreaIds.length
        ? {
            areaId: locationAreaIds[0],
            ...(locationAreaIds.length > 1 ? { areaIds: locationAreaIds } : { areaIds: undefined }),
            areaLabel: locationAreaLabel,
            neighbourhood: locationAreaLabel || salon.neighbourhood || "",
          }
        : {}),
      ...(req.body?.hijabiFriendly === true ? { hijabiFriendly: true } : {}),
      ...sanitizeFreshnessPricingUpdate(req.body || {}, salon),
      services: nextServices,
    };
    if (!manualIndex.salons[salonIndex].areaIds) {
      delete manualIndex.salons[salonIndex].areaIds;
    }
    manualIndex.meta = {
      ...manualIndex.meta,
      updatedAt: new Date().toISOString(),
      count: manualIndex.salons.length,
    };
    if (
      addServices.length ||
      removeServices.length ||
      req.body?.hijabiFriendly === true ||
      hasFreshnessPricingUpdate(req.body || {}) ||
      locationAreaIds.length ||
      typeof req.body?.bookingUrl === "string" ||
      typeof req.body?.instagramUrl === "string" ||
      typeof req.body?.websiteUrl === "string"
    ) {
      await writeJson(manualIndexPath, manualIndex);
    }

    const freshnessCheck = await updateFreshnessReview(req.params.id, {
      addServices,
      removeServices,
      rejectAddedServices,
      rejectRemovedServices,
      rejectHijabiFriendly,
      rejectPriceBand: req.body?.rejectPriceBand === true,
      rejectLocation: req.body?.rejectLocation === true,
      bookingUrl: typeof req.body?.bookingUrl === "string" ? cleanString(req.body.bookingUrl) : undefined,
      instagramUrl: typeof req.body?.instagramUrl === "string" ? cleanString(req.body.instagramUrl) : undefined,
      websiteUrl: typeof req.body?.websiteUrl === "string" ? cleanString(req.body.websiteUrl) : undefined,
      hijabiFriendly: req.body?.hijabiFriendly === true ? true : undefined,
      priceBand: sanitizePriceBand(req.body?.priceBand),
      areaId: locationAreaIds[0] || "",
      areaIds: locationAreaIds,
      areaLabel: locationAreaLabel,
      requestCheck: req.body?.check || null,
    });

    res.json({ ok: true, salon: manualIndex.salons[salonIndex], check: freshnessCheck });
  });

  app.patch("/api/admin/stylists/:id/freshness/undo", requireAdmin, async (req, res) => {
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const salonIndex = manualIndex.salons.findIndex((salon) => salon.id === req.params.id);
    if (salonIndex === -1) {
      return res.status(404).json({ ok: false, message: "Salon not found." });
    }

    const previousServices = normalizeServices(toArray(req.body?.previousServices));
    const hasPreviousHijabiFriendly = typeof req.body?.previousHijabiFriendly === "boolean";
    if (previousServices.length || hasPreviousHijabiFriendly) {
      manualIndex.salons[salonIndex] = {
        ...manualIndex.salons[salonIndex],
        ...(previousServices.length ? { services: previousServices } : {}),
        ...(hasPreviousHijabiFriendly ? { hijabiFriendly: req.body.previousHijabiFriendly } : {}),
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
      update: req.body?.update || {},
      rejectAddedServices: toArray(req.body?.rejectAddedServices),
      rejectRemovedServices: toArray(req.body?.rejectRemovedServices),
      rejectHijabiFriendly: req.body?.rejectHijabiFriendly === true,
      rejectPriceBand: req.body?.rejectPriceBand === true,
      rejectLocation: req.body?.rejectLocation === true,
    });

    res.json({ ok: true, salon: manualIndex.salons[salonIndex], check: restoredCheck });
  });

  app.post("/api/admin/stylists/intake", requireAdmin, async (req, res) => {
    const draft = await buildDraft(req.body || {});
    const store = await readDraftStore();
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const duplicates = findDraftDuplicates(draft, { drafts: store.drafts, salons: manualIndex.salons });
    if (duplicates.length) {
      return res.status(409).json({ ok: false, message: formatDuplicateMessage(duplicates), duplicates });
    }

    store.drafts.unshift(draft);
    await writeDraftStore(store);
    res.status(201).json({ ok: true, draft });
  });

  app.post("/api/admin/stylists/intake-bulk", requireAdmin, async (req, res) => {
    const candidates = parseBulkIntake(req.body?.text);
    if (!candidates.length) {
      return res.status(400).json({ ok: false, message: "Paste at least one social, booking, or website link." });
    }
    const priceBand = sanitizePriceBand(req.body?.priceBand);
    const pricingInput = priceBand
      ? {
          priceBand,
          priceSource: sanitizePriceSource(req.body?.priceSource) || "manual",
          priceEvidence: toArray(req.body?.priceEvidence),
          priceCheckedAt: cleanString(req.body?.priceCheckedAt),
          priceUpdatedAt: cleanString(req.body?.priceUpdatedAt),
          priceConfidence: sanitizePriceConfidence(req.body?.priceConfidence) || "manual",
        }
      : {};

    const store = await readDraftStore();
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const drafts = [];
    const duplicateResults = [];

    for (const candidate of candidates) {
      const draft = await buildDraft({ ...candidate, ...pricingInput });
      const duplicates = findDraftDuplicates(draft, { drafts: [...drafts, ...store.drafts], salons: manualIndex.salons });
      if (duplicates.length) {
        duplicateResults.push({ candidate: draft, duplicates });
        continue;
      }
      drafts.push(draft);
    }

    if (!drafts.length) {
      return res.status(409).json({
        ok: false,
        message: formatBulkDuplicateMessage(duplicateResults),
        duplicates: duplicateResults,
      });
    }

    store.drafts.unshift(...drafts);
    await writeDraftStore(store);
    res.status(201).json({ ok: true, drafts, duplicates: duplicateResults });
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
    const manualIndex = await readJson(manualIndexPath, { meta: { source: "manual" }, salons: [] });
    const duplicates = findDraftDuplicates(draft, { drafts: draftStore.drafts, salons: manualIndex.salons });
    if (duplicates.length) {
      return res.status(409).json({ ok: false, message: formatDuplicateMessage(duplicates), duplicates });
    }

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

async function updateFreshnessReview(salonId, {
  addServices = [],
  removeServices = [],
  rejectAddedServices = [],
  rejectRemovedServices = [],
  rejectHijabiFriendly = false,
  rejectPriceBand = false,
  rejectLocation = false,
  bookingUrl,
  instagramUrl,
  websiteUrl,
  hijabiFriendly,
  priceBand,
  areaId = "",
  areaIds = [],
  areaLabel = "",
  requestCheck = null,
}) {
  const store = await readFreshnessStore({ meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [], dismissedRecommendations: {} });
  const reviewedAdds = normalizeServices([...addServices, ...rejectAddedServices]);
  const reviewedRemoves = normalizeServices([...removeServices, ...rejectRemovedServices]);
  const currentCheck = (store.checks || []).find((check) => check.id === salonId);
  const actionCheck = currentCheck || sanitizeFreshnessCheck(requestCheck, salonId);
  const dismissedRecommendations = updateDismissedRecommendations(store.dismissedRecommendations || {}, salonId, {
    addServices,
    removeServices,
    rejectAddedServices,
    rejectRemovedServices,
    hijabiFriendly,
    rejectHijabiFriendly,
    bookingUrl,
    instagramUrl,
    websiteUrl,
    currentCheck: actionCheck,
    rejectPriceBand,
    dismissedPriceBand: rejectPriceBand ? sanitizePriceBand(actionCheck?.priceCheck?.priceBand) || "" : priceBand || "",
    priceBand,
    rejectLocation,
    dismissedLocationLabel: rejectLocation ? actionCheck?.serviceCheck?.areaLabel || "" : "",
    areaId,
    areaIds,
    areaLabel,
    rawServices: actionCheck?.serviceCheck?.rawServices || [],
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
      const reviewedPrice = Boolean(priceBand || rejectPriceBand);
      const reviewedLocation = Boolean(rejectLocation || areaId || areaIds.length || areaLabel);
      const nextAreaIds = normalizeAreaIds(areaIds.length ? areaIds : areaId ? [areaId] : []);
      const nextAreaLabel = cleanString(areaLabel) || areaLabelForIds(nextAreaIds);

      return {
        ...check,
        ...(bookingUrl !== undefined ? { bookingUrl } : {}),
        ...(instagramUrl !== undefined ? { instagramUrl } : {}),
        ...(websiteUrl !== undefined ? { websiteUrl } : {}),
        ...(hijabiFriendly === true ? { hijabiFriendly: true } : {}),
        ...(priceBand ? { priceBand } : {}),
        ...(nextAreaIds.length
          ? {
              areaId: nextAreaIds[0],
              areaIds: nextAreaIds,
              areaLabel: nextAreaLabel,
              locationReviewIgnored: false,
            }
          : {}),
        ...(rejectLocation ? { locationReviewIgnored: true } : {}),
        addedServices: (check.addedServices || []).filter((service) => !reviewedAdds.includes(service)),
        removedServices: (check.removedServices || []).filter((service) => !reviewedRemoves.includes(service)),
        attributeSuggestions: (check.attributeSuggestions || []).filter((suggestion) => {
          if (suggestion?.field !== "hijabiFriendly") {
            return true;
          }
          return hijabiFriendly !== true && rejectHijabiFriendly !== true;
        }),
        linkChecks: (check.linkChecks || []).filter((linkCheck) => !reviewedLinkTypes.has(linkCheck.type)),
        issues: (check.issues || []).filter((issue) => {
          if (reviewedLinkIssues.has(issue)) {
            return false;
          }
          return !(String(issue).toLowerCase() === "possible hijabi-friendly wording found" && (hijabiFriendly === true || rejectHijabiFriendly === true));
        }).filter((issue) => !((String(issue).toLowerCase() === "possible pricing band found" || String(issue).toLowerCase() === "manual price check required") && reviewedPrice)),
        serviceCheck: reviewedLocation && !nextAreaIds.length
          ? { ...(check.serviceCheck || emptyServiceCheck()), areaId: "", areaLabel: "" }
          : check.serviceCheck,
        ...(reviewedPrice ? { priceCheck: emptyPriceCheck(check.priceCheck?.source || "") } : {}),
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

  return checks.find((check) => check.id === salonId) || null;
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

async function undoFreshnessReview(salonId, { check, update = {}, rejectAddedServices = [], rejectRemovedServices = [], rejectHijabiFriendly = false, rejectPriceBand = false, rejectLocation = false }) {
  const store = await readFreshnessStore({ meta: { source: "freshness-checks", updatedAt: null, count: 0 }, checks: [], dismissedRecommendations: {} });
  const dismissedRecommendations = removeDismissedRecommendations(store.dismissedRecommendations || {}, salonId, {
    update,
    check,
    rejectAddedServices,
    rejectRemovedServices,
    rejectHijabiFriendly,
    rejectPriceBand,
    rejectLocation,
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

function updateDismissedRecommendations(dismissedRecommendations, salonId, {
  addServices = [],
  removeServices = [],
  rejectAddedServices = [],
  rejectRemovedServices = [],
  hijabiFriendly = false,
  rejectHijabiFriendly = false,
  bookingUrl,
  instagramUrl,
  websiteUrl,
  currentCheck = null,
  rejectPriceBand = false,
  dismissedPriceBand = "",
  priceBand = "",
  rejectLocation = false,
  dismissedLocationLabel = "",
  areaId = "",
  areaIds = [],
  areaLabel = "",
  rawServices = [],
}) {
  const reviewedAdds = normalizeServices([...addServices, ...rejectAddedServices]);
  const reviewedRemoves = normalizeServices([...removeServices, ...rejectRemovedServices]);
  const handledFingerprints = buildHandledFingerprintsForUpdate(currentCheck, {
    addServices,
    removeServices,
    rejectAddedServices,
    rejectRemovedServices,
    hijabiFriendly,
    rejectHijabiFriendly,
    bookingUrl,
    instagramUrl,
    websiteUrl,
    priceBand,
    rejectPriceBand,
    rejectLocation,
    areaId,
    areaIds,
    areaLabel,
  });
  if (!reviewedAdds.length && !reviewedRemoves.length && rejectHijabiFriendly !== true && hijabiFriendly !== true && rejectPriceBand !== true && !dismissedPriceBand && !priceBand && rejectLocation !== true && !dismissedLocationLabel && !areaId && !areaIds.length && !areaLabel && !handledFingerprints.length) {
    return dismissedRecommendations;
  }

  const current = dismissedRecommendations[salonId] || {};
  const addedServiceEvidence = { ...(current.addedServiceEvidence || {}) };
  reviewedAdds.forEach((service) => {
    const evidence = getServiceEvidence(rawServices, service);
    if (evidence.length) {
      addedServiceEvidence[service] = [...new Set([...(addedServiceEvidence[service] || []), ...evidence])];
    }
  });
  return {
    ...dismissedRecommendations,
    [salonId]: {
      addedServices: [...new Set([...(current.addedServices || []), ...reviewedAdds])],
      removedServices: [...new Set([...(current.removedServices || []), ...reviewedRemoves])],
      addedServiceFamilies: [...new Set([...(current.addedServiceFamilies || []), ...reviewedAdds.map(serviceFamilyFor).filter(Boolean)])],
      addedServiceEvidence,
      handledFingerprints: [...new Set([...(current.handledFingerprints || []), ...handledFingerprints])],
      ...(rejectHijabiFriendly === true || hijabiFriendly === true ? { hijabiFriendly: true } : current.hijabiFriendly === true ? { hijabiFriendly: true } : {}),
      ...(dismissedPriceBand || priceBand ? { priceBand: dismissedPriceBand || priceBand } : current.priceBand ? { priceBand: current.priceBand } : {}),
      ...(dismissedLocationLabel || areaLabel ? { locationLabel: dismissedLocationLabel || areaLabel } : current.locationLabel ? { locationLabel: current.locationLabel } : {}),
    },
  };
}

function removeDismissedRecommendations(dismissedRecommendations, salonId, { update = {}, check = null, rejectAddedServices = [], rejectRemovedServices = [], rejectHijabiFriendly = false, rejectPriceBand = false, rejectLocation = false }) {
  const undoUpdate = {
    ...update,
    rejectAddedServices: update.rejectAddedServices || rejectAddedServices,
    rejectRemovedServices: update.rejectRemovedServices || rejectRemovedServices,
    rejectHijabiFriendly: update.rejectHijabiFriendly === true || rejectHijabiFriendly === true,
    rejectPriceBand: update.rejectPriceBand === true || rejectPriceBand === true,
    rejectLocation: update.rejectLocation === true || rejectLocation === true,
  };
  const reviewedAdds = normalizeServices([...(undoUpdate.addServices || []), ...(undoUpdate.rejectAddedServices || [])]);
  const reviewedRemoves = normalizeServices([...(undoUpdate.removeServices || []), ...(undoUpdate.rejectRemovedServices || [])]);
  const handledFingerprints = buildHandledFingerprintsForUpdate(check, undoUpdate);
  if (!reviewedAdds.length && !reviewedRemoves.length && undoUpdate.rejectHijabiFriendly !== true && undoUpdate.hijabiFriendly !== true && undoUpdate.rejectPriceBand !== true && !undoUpdate.priceBand && undoUpdate.rejectLocation !== true && !undoUpdate.areaId && !toArray(undoUpdate.areaIds).length && !undoUpdate.areaLabel && !handledFingerprints.length) {
    return dismissedRecommendations;
  }

  const current = dismissedRecommendations[salonId] || {};
  const next = {
    addedServices: (current.addedServices || []).filter((service) => !reviewedAdds.includes(service)),
    removedServices: (current.removedServices || []).filter((service) => !reviewedRemoves.includes(service)),
    addedServiceFamilies: (current.addedServiceFamilies || []).filter((family) => !reviewedAdds.map(serviceFamilyFor).includes(family)),
    addedServiceEvidence: Object.fromEntries(Object.entries(current.addedServiceEvidence || {}).filter(([service]) => !reviewedAdds.includes(service))),
    handledFingerprints: (current.handledFingerprints || []).filter((fingerprint) => !handledFingerprints.includes(fingerprint)),
    ...(undoUpdate.rejectHijabiFriendly === true || undoUpdate.hijabiFriendly === true ? {} : current.hijabiFriendly === true ? { hijabiFriendly: true } : {}),
    ...(undoUpdate.rejectPriceBand === true || undoUpdate.priceBand ? {} : current.priceBand ? { priceBand: current.priceBand } : {}),
    ...(undoUpdate.rejectLocation === true || undoUpdate.areaId || toArray(undoUpdate.areaIds).length || undoUpdate.areaLabel ? {} : current.locationLabel ? { locationLabel: current.locationLabel } : {}),
  };
  const updated = { ...dismissedRecommendations };
  if (next.addedServices.length || next.removedServices.length || next.handledFingerprints.length || next.hijabiFriendly === true || next.priceBand || next.locationLabel) {
    updated[salonId] = next;
  } else {
    delete updated[salonId];
  }
  return updated;
}

function buildHandledFingerprintsForUpdate(check, update = {}) {
  if (!check) {
    return [];
  }

  const fingerprints = [];
  normalizeServices([...(update.addServices || []), ...(update.rejectAddedServices || [])]).forEach((service) => {
    fingerprints.push(serviceRecommendationFingerprint("add", service, getServiceEvidence(check.serviceCheck?.rawServices || [], service)));
  });
  normalizeServices([...(update.removeServices || []), ...(update.rejectRemovedServices || [])]).forEach((service) => {
    fingerprints.push(serviceRecommendationFingerprint("remove", service));
  });

  if (update.hijabiFriendly === true || update.rejectHijabiFriendly === true) {
    fingerprints.push(...(check.attributeSuggestions || []).map(attributeRecommendationFingerprint));
  }

  const reviewedLinkTypes = getReviewedLinkTypes(update);
  (check.linkChecks || [])
    .filter((linkCheck) => reviewedLinkTypes.has(linkCheck.type))
    .forEach((linkCheck) => {
      fingerprints.push(linkRecommendationFingerprint(linkCheck));
      fingerprints.push(linkRecommendationSummaryFingerprint(linkCheck));
    });

  if (update.priceBand || update.rejectPriceBand === true) {
    fingerprints.push(priceRecommendationFingerprint(check.priceCheck));
    fingerprints.push(priceRecommendationSummaryFingerprint(check.priceCheck));
  }

  if (update.rejectLocation === true || update.areaId || toArray(update.areaIds).length || update.areaLabel) {
    fingerprints.push(locationRecommendationFingerprint(check));
    fingerprints.push(locationRecommendationSummaryFingerprint(check));
  }

  if (!fingerprints.length) {
    fingerprints.push(...toArray(check.issues).map(genericIssueFingerprint));
  }

  return [...new Set(fingerprints.filter(Boolean))];
}

function getDismissedFingerprintSet(dismissedRecommendation = {}) {
  return new Set(toArray(dismissedRecommendation.handledFingerprints));
}

function hasDismissedFingerprintKind(fingerprints, kindPrefix) {
  return [...fingerprints].some((fingerprint) => String(fingerprint).startsWith(`${kindPrefix}:`) || String(fingerprint).startsWith(kindPrefix));
}

function serviceRecommendationFingerprint(kind, service, evidence = []) {
  return healthRecommendationFingerprint(`service-${kind}`, [service, ...toArray(evidence).slice(0, 6)]);
}

function linkRecommendationFingerprint(linkCheck = {}) {
  return healthRecommendationFingerprint("link", [
    linkCheck.type,
    linkCheck.url,
    linkCheck.finalUrl,
    linkCheck.status,
    linkCheck.httpStatus,
    ...(linkCheck.issues || []),
  ]);
}

function linkRecommendationSummaryFingerprint(linkCheck = {}) {
  return healthRecommendationFingerprint("link", [
    linkCheck.type,
    linkCheck.url,
    linkCheck.status,
    linkCheck.httpStatus,
  ]);
}

function priceRecommendationFingerprint(priceCheck = {}) {
  return healthRecommendationFingerprint("price", [
    priceCheck.priceBand,
    priceCheck.confidence,
    ...(priceCheck.prices || []),
    ...(priceCheck.evidence || []),
  ]);
}

function priceRecommendationSummaryFingerprint(priceCheck = {}) {
  return healthRecommendationFingerprint("price", [
    priceCheck.priceBand,
    priceCheck.confidence,
  ]);
}

function locationRecommendationFingerprint(check = {}) {
  return healthRecommendationFingerprint("location", [
    check.areaLabel,
    check.serviceCheck?.areaId,
    check.serviceCheck?.areaLabel,
  ]);
}

function locationRecommendationSummaryFingerprint(check = {}) {
  return healthRecommendationFingerprint("location", [
    check.serviceCheck?.areaId,
    check.serviceCheck?.areaLabel,
  ]);
}

function attributeRecommendationFingerprint(suggestion = {}) {
  return healthRecommendationFingerprint("attribute", [
    suggestion.field,
    suggestion.value === true ? "true" : "",
    ...(suggestion.evidence || []).map((item) => `${item.source || ""}:${item.text || ""}`),
  ]);
}

function genericIssueFingerprint(issue) {
  return healthRecommendationFingerprint("issue", [issue]);
}

function healthRecommendationFingerprint(kind, parts = []) {
  const normalizedParts = toArray(parts)
    .map((part) => normalizeFingerprintText(part))
    .filter(Boolean);
  return `${kind}:${normalizedParts.join("|")}`;
}

function normalizeFingerprintText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/\/+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDismissedLinkRecommendation(fingerprints, linkCheck = {}) {
  if (fingerprints.has(linkRecommendationFingerprint(linkCheck)) || fingerprints.has(linkRecommendationSummaryFingerprint(linkCheck))) {
    return true;
  }

  const type = normalizeFingerprintText(linkCheck.type);
  const url = normalizeFingerprintText(linkCheck.url).replace(/^www\./, "");
  const status = normalizeFingerprintText(linkCheck.status);
  return [...fingerprints].some((fingerprint) => {
    const normalized = normalizeFingerprintText(fingerprint).replace(/^link:www\./, "link:");
    return normalized.startsWith(`link:${type}|${url}|`) && (!status || normalized.includes(`|${status}`));
  });
}

function hasDismissedPriceRecommendation(fingerprints, priceCheck = {}, dismissedPriceBand = "") {
  if (fingerprints.has(priceRecommendationFingerprint(priceCheck)) || fingerprints.has(priceRecommendationSummaryFingerprint(priceCheck))) {
    return true;
  }

  const band = normalizeFingerprintText(priceCheck.priceBand);
  if (!band) {
    return false;
  }

  if (normalizeFingerprintText(dismissedPriceBand) === band) {
    return true;
  }

  const confidence = normalizeFingerprintText(priceCheck.confidence);
  return [...fingerprints].some((fingerprint) => {
    const normalized = normalizeFingerprintText(fingerprint);
    return normalized === `price:${band}` || normalized.startsWith(`price:${band}|${confidence}|`) || normalized.startsWith(`price:${band}|`);
  });
}

function hasDismissedLocationRecommendation(fingerprints, check = {}, dismissedLocationLabel = "") {
  if (fingerprints.has(locationRecommendationFingerprint(check)) || fingerprints.has(locationRecommendationSummaryFingerprint(check))) {
    return true;
  }

  const detectedLabel = normalizeFingerprintText(check.serviceCheck?.areaLabel);
  const detectedId = normalizeFingerprintText(check.serviceCheck?.areaId);
  if (detectedLabel && normalizeFingerprintText(dismissedLocationLabel) === detectedLabel) {
    return true;
  }

  return [...fingerprints].some((fingerprint) => {
    const normalized = normalizeFingerprintText(fingerprint);
    if (!normalized.startsWith("location:")) {
      return false;
    }
    return (detectedId && normalized.includes(`|${detectedId}|`)) || (detectedLabel && normalized.endsWith(`|${detectedLabel}`));
  });
}

function sanitizeFreshnessCheck(check, salonId) {
  if (!check || check.id !== salonId) {
    return null;
  }

  return {
    id: salonId,
    name: cleanString(check.name),
    areaId: cleanString(check.areaId),
    areaIds: normalizeAreaIds(check.areaIds),
    areaLabel: cleanString(check.areaLabel),
    locationReviewIgnored: check.locationReviewIgnored === true,
    bookingUrl: cleanString(check.bookingUrl),
    instagramUrl: cleanString(check.instagramUrl),
    websiteUrl: cleanString(check.websiteUrl),
    priceBand: sanitizePriceBand(check.priceBand),
    priceSource: sanitizePriceSource(check.priceSource),
    priceConfidence: sanitizePriceConfidence(check.priceConfidence),
    backfillStatus: sanitizeBackfillStatus(check.backfillStatus),
    backfillReason: cleanString(check.backfillReason),
    issues: toArray(check.issues),
    linkChecks: Array.isArray(check.linkChecks) ? check.linkChecks : [],
    serviceCheck: check.serviceCheck || emptyServiceCheck(),
    priceCheck: sanitizePriceCheck(check.priceCheck),
    attributeSuggestions: sanitizeAttributeSuggestions(check.attributeSuggestions),
    currentServices: normalizeServices(toArray(check.currentServices)),
    detectedServices: normalizeServices(toArray(check.detectedServices)),
    addedServices: normalizeServices(toArray(check.addedServices)),
    removedServices: normalizeServices(toArray(check.removedServices)),
    checkedAt: check.checkedAt || new Date().toISOString(),
  };
}

function hydrateFreshnessCheckFromSalon(check, salon = {}) {
  if (!check) {
    return null;
  }

  const savedPriceBand = sanitizePriceBand(salon.priceBand || check.priceBand);
  const next = {
    ...check,
    priceBand: savedPriceBand,
    priceSource: sanitizePriceSource(salon.priceSource || check.priceSource),
    priceConfidence: sanitizePriceConfidence(salon.priceConfidence || check.priceConfidence),
  };

  if (savedPriceBand && (next.backfillStatus === "no-price" || next.backfillStatus === "skipped-social")) {
    return {
      ...next,
      backfillStatus: "verified",
      backfillReason: "Saved price band exists.",
      issues: toArray(next.issues).filter((issue) => String(issue).toLowerCase() !== "manual price check required"),
    };
  }

  return next;
}

function sanitizeBackfillStatus(value) {
  const cleaned = cleanString(value);
  return ["auto-applied", "needs-review", "no-price", "skipped-social", "verified"].includes(cleaned) ? cleaned : "";
}

function applyDismissedRecommendationToCheck(check, dismissedRecommendation = {}) {
  if (!check) {
    return null;
  }

  const dismissedFingerprints = getDismissedFingerprintSet(dismissedRecommendation);
  const hasServiceDismissals = hasDismissedFingerprintKind(dismissedFingerprints, "service-");
  const hasAttributeDismissals = hasDismissedFingerprintKind(dismissedFingerprints, "attribute");
  const hasPriceDismissals = hasDismissedFingerprintKind(dismissedFingerprints, "price");
  const hasLocationDismissals = hasDismissedFingerprintKind(dismissedFingerprints, "location");
  const dismissedAddedServices = normalizeServices(dismissedRecommendation.addedServices || []);
  const dismissedRemovedServices = normalizeServices(dismissedRecommendation.removedServices || []);
  const dismissedPriceBand = dismissedRecommendation.priceBand || "";
  const dismissedLocationLabel = dismissedRecommendation.locationLabel || "";

  const next = {
    ...check,
    issues: toArray(check.issues),
    linkChecks: Array.isArray(check.linkChecks) ? check.linkChecks : [],
    attributeSuggestions: Array.isArray(check.attributeSuggestions) ? check.attributeSuggestions : [],
    addedServices: normalizeServices(toArray(check.addedServices)),
    removedServices: normalizeServices(toArray(check.removedServices)),
    priceCheck: sanitizePriceCheck(check.priceCheck),
  };

  next.addedServices = next.addedServices.filter((service) => {
    if (!hasServiceDismissals && dismissedAddedServices.includes(service)) {
      return false;
    }
    return !dismissedFingerprints.has(serviceRecommendationFingerprint("add", service, getServiceEvidence(next.serviceCheck?.rawServices || [], service)));
  });
  next.removedServices = next.removedServices.filter((service) => {
    if (!hasServiceDismissals && dismissedRemovedServices.includes(service)) {
      return false;
    }
    return !dismissedFingerprints.has(serviceRecommendationFingerprint("remove", service));
  });

  next.attributeSuggestions = next.attributeSuggestions.filter((suggestion) => {
    if (!hasAttributeDismissals && dismissedRecommendation.hijabiFriendly === true && suggestion?.field === "hijabiFriendly") {
      return false;
    }
    return !dismissedFingerprints.has(attributeRecommendationFingerprint(suggestion));
  });

  next.linkChecks = next.linkChecks.filter((linkCheck) => {
    if (linkCheck?.status === "ok") {
      return true;
    }
    return !hasDismissedLinkRecommendation(dismissedFingerprints, linkCheck);
  });

  const priceFingerprintDismissed = hasDismissedPriceRecommendation(dismissedFingerprints, next.priceCheck, hasPriceDismissals ? "" : dismissedPriceBand);
  if (priceFingerprintDismissed) {
    if (next.priceCheck?.priceBand && next.priceCheck.confidence !== "high") {
      next.priceCheck = emptyPriceCheck(next.priceCheck.source || "");
    }
    next.issues = next.issues.filter((issue) => {
      const lower = String(issue).toLowerCase();
      return lower !== "possible pricing band found" && lower !== "manual price check required";
    });
  }

  const locationFingerprintDismissed = hasDismissedLocationRecommendation(dismissedFingerprints, next, hasLocationDismissals ? "" : dismissedLocationLabel);
  if (locationFingerprintDismissed) {
    next.locationReviewIgnored = true;
  }

  next.issues = next.issues.filter((issue) => !dismissedFingerprints.has(genericIssueFingerprint(issue)));

  return next;
}

function hasActionableFreshnessCheck(check) {
  if (check.addedServices?.length || check.removedServices?.length) {
    return true;
  }

  if (check.attributeSuggestions?.length) {
    return true;
  }

  if (check.priceCheck?.priceBand && check.priceCheck.confidence !== "high") {
    return true;
  }

  if (check.linkChecks?.some((linkCheck) => isActionableBrokenLink(linkCheck) || isManualCheckLink(linkCheck))) {
    return true;
  }

  if (hasDetectedLocationFreshnessUpdate(check)) {
    return true;
  }

  return (check.issues || []).some((issue) => {
    const normalizedIssue = String(issue).toLowerCase();
    return normalizedIssue !== "possible new services found" && normalizedIssue !== "possible removed services found" && normalizedIssue !== "possible hijabi-friendly wording found" && normalizedIssue !== "possible pricing band found";
  });
}

function hasDetectedLocationFreshnessUpdate(check) {
  const detectedLocation = normalizeFreshnessLocationLabel(check.serviceCheck?.areaLabel);
  const savedLocation = normalizeFreshnessLocationLabel(check.areaLabel);
  return Boolean(!check.locationReviewIgnored && detectedLocation && savedLocation && detectedLocation !== savedLocation);
}

function normalizeFreshnessLocationLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\blondon\b/g, "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sanitizePriceCheck(priceCheck) {
  if (!priceCheck) {
    return emptyPriceCheck();
  }
  const priceBand = sanitizePriceBand(priceCheck.priceBand);
  const servicePriceBand = sanitizePriceBand(priceCheck.servicePriceBand);
  const packagePriceBand = sanitizePriceBand(priceCheck.packagePriceBand);
  return {
    source: cleanString(priceCheck.source),
    confidence: sanitizePriceConfidence(priceCheck.confidence) || "unknown",
    priceBand,
    medianPrice: Number.isFinite(Number(priceCheck.medianPrice)) ? Number(priceCheck.medianPrice) : null,
    prices: Array.isArray(priceCheck.prices)
      ? priceCheck.prices.map((price) => Number(price)).filter((price) => Number.isFinite(price) && price >= 10 && price <= 5000).sort((left, right) => left - right)
      : [],
    priceCount: Number(priceCheck.priceCount) || 0,
    evidence: toArray(priceCheck.evidence),
    servicePriceBand,
    serviceMedianPrice: Number.isFinite(Number(priceCheck.serviceMedianPrice)) ? Number(priceCheck.serviceMedianPrice) : null,
    servicePrices: Array.isArray(priceCheck.servicePrices)
      ? priceCheck.servicePrices.map((price) => Number(price)).filter((price) => Number.isFinite(price) && price >= 10 && price <= 5000).sort((left, right) => left - right)
      : [],
    servicePriceCount: Number(priceCheck.servicePriceCount) || 0,
    packagePriceBand,
    packageMedianPrice: Number.isFinite(Number(priceCheck.packageMedianPrice)) ? Number(priceCheck.packageMedianPrice) : null,
    packagePrices: Array.isArray(priceCheck.packagePrices)
      ? priceCheck.packagePrices.map((price) => Number(price)).filter((price) => Number.isFinite(price) && price >= 10 && price <= 5000).sort((left, right) => left - right)
      : [],
    packagePriceCount: Number(priceCheck.packagePriceCount) || 0,
    priceIncludesHair: priceCheck.priceIncludesHair === true,
    priceComparisonMode: sanitizePriceComparisonMode(priceCheck.priceComparisonMode),
  };
}

function stripAutoAppliedPriceCheck(check) {
  if (check?.priceCheck?.priceBand && check.priceCheck.confidence === "high") {
    const { priceCheck, ...rest } = check;
    return rest;
  }
  return check;
}

function sanitizeAttributeSuggestions(suggestions) {
  return (Array.isArray(suggestions) ? suggestions : [])
    .map((suggestion) => {
      if (suggestion?.field !== "hijabiFriendly" || suggestion.value !== true) {
        return null;
      }

      const evidence = (Array.isArray(suggestion.evidence) ? suggestion.evidence : [])
        .map((item) => ({
          source: cleanString(item?.source),
          text: cleanString(item?.text),
        }))
        .filter((item) => item.source && item.text);

      if (!evidence.length) {
        return null;
      }

      return {
        field: "hijabiFriendly",
        value: true,
        label: "Hijabi friendly",
        evidence,
      };
    })
    .filter(Boolean);
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
  const dismissedFingerprints = getDismissedFingerprintSet(dismissedRecommendation);
  const hasServiceDismissals = hasDismissedFingerprintKind(dismissedFingerprints, "service-");
  const hasAttributeDismissals = hasDismissedFingerprintKind(dismissedFingerprints, "attribute");
  const hasLocationDismissals = hasDismissedFingerprintKind(dismissedFingerprints, "location");
  const [bookingLinkCheck, instagramLinkCheck, websiteLinkCheck] = await Promise.all([
    checkUrl("booking", salon.bookingUrl, { includeText: true }),
    checkUrl("instagram", salon.instagramUrl),
    checkUrl("website", salon.websiteUrl && salon.websiteUrl !== salon.bookingUrl ? salon.websiteUrl : "", { includeText: true }),
  ]);
  const linkChecks = preserveKnownBrokenInstagramLink([bookingLinkCheck, instagramLinkCheck, websiteLinkCheck].map(stripLinkCheckResponseText), previousCheck);
  const activeLinkChecks = linkChecks.filter(Boolean).filter((linkCheck) => {
    if (linkCheck.status === "ok") {
      return true;
    }
    return !hasDismissedLinkRecommendation(dismissedFingerprints, linkCheck);
  });
  const issues = activeLinkChecks.flatMap((check) => check.issues);
  const bookingCheck = activeLinkChecks.find((check) => check.type === "booking");
  const websiteCheck = activeLinkChecks.find((check) => check.type === "website");
  const embeddedBookingSources = await fetchEmbeddedBookingSources([
    { html: bookingLinkCheck?.responseText || "", url: salon.bookingUrl || "" },
    { html: websiteLinkCheck?.responseText || "", url: salon.websiteUrl || "" },
  ]);
  const enrichedBookingHtml = combineBookingHtml(bookingLinkCheck?.responseText || "", embeddedBookingSources);
  const serviceCheck = await extractBestServiceCheck({
    booking: enrichedBookingHtml,
    website: websiteCheck?.status === "ok" ? websiteLinkCheck?.responseText || "" : "",
    bookingUrl: embeddedBookingSources[0]?.url || salon.bookingUrl || "",
    websiteUrl: salon.websiteUrl || "",
    allowAiFallback: true,
  });
  const attributeSuggestions = buildAttributeSuggestions(salon, {
    booking: bookingLinkCheck?.responseText || "",
    website: websiteLinkCheck?.responseText || "",
    instagram: instagramLinkCheck?.profileText || "",
  }, hasAttributeDismissals ? { ...dismissedRecommendation, hijabiFriendly: false } : dismissedRecommendation).filter((suggestion) => !dismissedFingerprints.has(attributeRecommendationFingerprint(suggestion)));
  const currentServices = normalizeServices(salon.services || []);
  const detectedServices = adjustDetectedServicesForCurrentContext(normalizeServices(serviceCheck.matchedServices), currentServices, serviceCheck.rawServices);
  const dismissedAddedServices = normalizeServices(dismissedRecommendation.addedServices || []);
  const dismissedRemovedServices = normalizeServices(dismissedRecommendation.removedServices || []);
  const dismissedAddedFamilies = new Set(dismissedRecommendation.addedServiceFamilies || []);
  const addedServices = detectedServices.filter((service) => {
    if (currentServices.includes(service) || (!hasServiceDismissals && dismissedAddedServices.includes(service))) {
      return false;
    }

    if (dismissedFingerprints.has(serviceRecommendationFingerprint("add", service, getServiceEvidence(serviceCheck.rawServices, service)))) {
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
      ? currentServices.filter((service) => !detectedServices.includes(service) && (!hasServiceDismissals ? !dismissedRemovedServices.includes(service) : true) && !dismissedFingerprints.has(serviceRecommendationFingerprint("remove", service)))
      : [];

  if (addedServices.length > 0) {
    issues.push("Possible new services found");
  }
  if (removedServices.length > 0) {
    issues.push("Possible removed services found");
  }
  if (attributeSuggestions.length > 0) {
    issues.push("Possible hijabi-friendly wording found");
  }

  const detectedLocationLabel = serviceCheck.areaLabel || "";
  const dismissedLocationLabel = dismissedRecommendation.locationLabel || "";
  const provisionalLocationCheck = { areaLabel: salon.areaLabel, serviceCheck };
  const locationFingerprintDismissed = hasDismissedLocationRecommendation(dismissedFingerprints, provisionalLocationCheck, hasLocationDismissals ? "" : dismissedLocationLabel);
  const locationReviewIgnored = locationFingerprintDismissed
    || (previousCheck?.locationReviewIgnored === true && detectedLocationLabel === (previousCheck?.serviceCheck?.areaLabel || ""))
    || (!hasLocationDismissals && dismissedLocationLabel && detectedLocationLabel === dismissedLocationLabel);

  const actionableIssues = [...new Set(issues)].filter((issue) => !dismissedFingerprints.has(genericIssueFingerprint(issue)));

  return {
    id: salon.id,
    name: salon.name,
    areaLabel: salon.areaLabel,
    bookingUrl: salon.bookingUrl || "",
    instagramUrl: salon.instagramUrl || "",
    websiteUrl: salon.websiteUrl || "",
    hijabiFriendly: salon.hijabiFriendly === true,
    issues: actionableIssues,
    linkChecks: activeLinkChecks,
    serviceCheck,
    priceCheck: emptyPriceCheck("health"),
    attributeSuggestions,
    currentServices,
    detectedServices,
    addedServices,
    removedServices,
    locationReviewIgnored: locationReviewIgnored || false,
    checkedAt: new Date().toISOString(),
  };
}

async function checkPricingFreshness(salon, dismissedRecommendation = {}) {
  const baseCheck = emptyFreshnessCheckForSalon(salon);
  const hasSavedPrice = Boolean(salon.priceBand);
  const dismissedFingerprints = getDismissedFingerprintSet(dismissedRecommendation);
  if (!isPricingCheckCandidate(salon)) {
    if (hasSavedPrice) {
      return {
        ...baseCheck,
        backfillStatus: "verified",
        backfillReason: "Saved price band exists, but there is no machine-readable booking or website URL to refresh it.",
      };
    }
    if (hasDismissedPriceRecommendation(dismissedFingerprints, emptyPriceCheck("booking"), dismissedRecommendation.priceBand || "")) {
      return baseCheck;
    }
    return {
      ...baseCheck,
      backfillStatus: "skipped-social",
      backfillReason: "Skipped because this listing is Instagram/social-only and has no saved price band.",
      issues: ["Manual price check required"],
    };
  }

  const urls = getMissingPriceBackfillUrls(salon);
  if (!urls.bookingUrl && !urls.websiteUrl) {
    if (hasSavedPrice) {
      return {
        ...baseCheck,
        backfillStatus: "verified",
        backfillReason: "Saved price band exists, but there is no machine-readable booking or website URL to refresh it.",
      };
    }
    if (hasDismissedPriceRecommendation(dismissedFingerprints, emptyPriceCheck("booking"), dismissedRecommendation.priceBand || "")) {
      return baseCheck;
    }
    return {
      ...baseCheck,
      backfillStatus: "skipped-social",
      backfillReason: "Skipped because there is no machine-readable booking or website URL.",
      issues: ["Manual price check required"],
    };
  }

  const [bookingLinkCheck, websiteLinkCheck] = await Promise.all([
    urls.bookingUrl ? checkUrl("booking", urls.bookingUrl, { includeText: true }) : null,
    urls.websiteUrl && urls.websiteUrl !== urls.bookingUrl ? checkUrl("website", urls.websiteUrl, { includeText: true }) : null,
  ]);
  const bookingHtml = bookingLinkCheck?.status === "ok" ? bookingLinkCheck.responseText || "" : "";
  const websiteHtml = websiteLinkCheck?.status === "ok" ? websiteLinkCheck.responseText || "" : "";
  const embeddedBookingSources = await fetchEmbeddedBookingSources([
    { html: bookingHtml, url: urls.bookingUrl },
    { html: websiteHtml, url: urls.websiteUrl },
  ]);
  const enrichedBookingHtml = combineBookingHtml(bookingHtml, embeddedBookingSources);
  let priceCheck = await extractBestPriceCheck({
    booking: enrichedBookingHtml,
    website: websiteHtml,
    bookingUrl: embeddedBookingSources[0]?.url || urls.bookingUrl,
    websiteUrl: urls.websiteUrl,
    allowAiFallback: true,
  });

  if (priceCheck.confidence === "unknown") {
    priceCheck = await extractDirectSiteFallbackPriceCheck({
      bookingHtml: enrichedBookingHtml,
      websiteHtml,
      bookingUrl: urls.bookingUrl,
      websiteUrl: urls.websiteUrl,
      allowAiFallback: true,
    });
  }

  if (!priceCheck.priceBand) {
    if (hasSavedPrice) {
      return {
        ...baseCheck,
        backfillStatus: "verified",
        backfillReason: "Saved price band exists but no machine-readable pricing was found to verify it.",
        linkChecks: [bookingLinkCheck, websiteLinkCheck].filter(Boolean).map(stripLinkCheckResponseText),
      };
    }
    if (hasDismissedPriceRecommendation(dismissedFingerprints, priceCheck, dismissedRecommendation.priceBand || "")) {
      return baseCheck;
    }
    return {
      ...baseCheck,
      backfillStatus: "no-price",
      backfillReason: "No machine-readable service pricing found.",
      issues: ["Manual price check required"],
      linkChecks: [bookingLinkCheck, websiteLinkCheck].filter(Boolean).map(stripLinkCheckResponseText),
      priceCheck,
    };
  }

  if (hasSavedPrice && priceCheck.priceBand === salon.priceBand) {
    return {
      ...baseCheck,
      backfillStatus: "verified",
      backfillReason: "Detected pricing matches the saved price band.",
      linkChecks: [bookingLinkCheck, websiteLinkCheck].filter(Boolean).map(stripLinkCheckResponseText),
      priceCheck: emptyPriceCheck(priceCheck.source || "booking"),
    };
  }

  const priceDismissed = hasDismissedPriceRecommendation(
    getDismissedFingerprintSet(dismissedRecommendation),
    priceCheck,
    dismissedRecommendation.priceBand || "",
  );
  if (priceDismissed) {
    return {
      ...baseCheck,
      priceCheck: emptyPriceCheck(priceCheck.source || "booking"),
    };
  }

  const autoUpdate = getAutoPricingUpdate(priceCheck);
  return {
    ...baseCheck,
    backfillStatus: autoUpdate ? "auto-applied" : "needs-review",
    backfillReason: autoUpdate
      ? hasSavedPrice ? "High-confidence structured booking prices updated the saved band." : "High-confidence structured booking prices were auto-applied."
      : hasSavedPrice ? `Detected ${priceCheck.priceBand}, saved ${salon.priceBand}. Review before changing.` : "Pricing found, but needs admin review before publishing.",
    issues: autoUpdate ? [] : ["Possible pricing band found"],
    linkChecks: [bookingLinkCheck, websiteLinkCheck].filter(Boolean).map(stripLinkCheckResponseText),
    priceCheck,
  };
}

const checkMissingPriceBackfill = checkPricingFreshness;

function emptyFreshnessCheckForSalon(salon) {
  return {
    id: salon.id,
    name: salon.name,
    areaLabel: salon.areaLabel,
    bookingUrl: salon.bookingUrl || "",
    instagramUrl: salon.instagramUrl || "",
    websiteUrl: salon.websiteUrl || "",
    hijabiFriendly: salon.hijabiFriendly === true,
    priceBand: sanitizePriceBand(salon.priceBand),
    priceSource: sanitizePriceSource(salon.priceSource),
    priceConfidence: sanitizePriceConfidence(salon.priceConfidence),
    issues: [],
    linkChecks: [],
    serviceCheck: emptyServiceCheck(),
    priceCheck: emptyPriceCheck("booking"),
    attributeSuggestions: [],
    currentServices: normalizeServices(salon.services || []),
    detectedServices: [],
    addedServices: [],
    removedServices: [],
    locationReviewIgnored: false,
    checkedAt: new Date().toISOString(),
  };
}

function isMissingPriceBackfillCandidate(salon = {}) {
  const urls = getMissingPriceBackfillUrls(salon);
  return Boolean((urls.bookingUrl && !isSocialOnlyUrl(urls.bookingUrl)) || (urls.websiteUrl && !isSocialOnlyUrl(urls.websiteUrl)));
}

function isPricingCheckCandidate(salon = {}) {
  return isMissingPriceBackfillCandidate(salon);
}

function getMissingPriceBackfillUrls(salon = {}) {
  const bookingUrl = cleanString(salon.bookingUrl);
  const websiteUrl = cleanString(salon.websiteUrl);
  return {
    bookingUrl: bookingUrl && !isSocialOnlyUrl(bookingUrl) ? bookingUrl : "",
    websiteUrl: websiteUrl && !isSocialOnlyUrl(websiteUrl) ? websiteUrl : "",
  };
}

function isSocialOnlyUrl(url = "") {
  const host = safeHost(url);
  return !host || /(^|\.)instagram\.com$|(^|\.)tiktok\.com$|(^|\.)facebook\.com$|(^|\.)linktr\.ee$|(^|\.)linktree\.com$|(^|\.)beacons\.ai$|(^|\.)bio\.site$|(^|\.)campsite\.bio$|(^|\.)solo\.to$/i.test(host);
}

function hasVisibleMissingPriceBackfillResult(check) {
  if (!check?.backfillStatus) {
    return hasActionableFreshnessCheck(check);
  }
  if (sanitizePriceBand(check.priceBand) && (check.backfillStatus === "no-price" || check.backfillStatus === "skipped-social")) {
    return false;
  }
  return check.backfillStatus === "needs-review" || check.backfillStatus === "no-price" || check.backfillStatus === "skipped-social";
}

function summarizeMissingPriceBackfillResults(checks = []) {
  return checks.reduce((summary, check) => {
    const status = check?.backfillStatus || "unknown";
    if (sanitizePriceBand(check?.priceBand) && (status === "no-price" || status === "skipped-social")) {
      return summary;
    }
    if (status === "auto-applied") summary.autoApplied += 1;
    else if (status === "needs-review") summary.needsReview += 1;
    else if (status === "no-price") summary.noPrice += 1;
    else if (status === "skipped-social") summary.skippedSocial += 1;
    else summary.unknown += 1;
    return summary;
  }, { autoApplied: 0, needsReview: 0, noPrice: 0, skippedSocial: 0, unknown: 0 });
}

function buildAttributeSuggestions(salon, sources, dismissedRecommendation = {}) {
  if (salon.hijabiFriendly === true || dismissedRecommendation.hijabiFriendly === true) {
    return [];
  }

  const evidence = Object.entries(sources)
    .flatMap(([source, text]) => findHijabiFriendlyEvidence(text).map((line) => ({ source, text: line })))
    .slice(0, 6);

  return evidence.length
    ? [{
        field: "hijabiFriendly",
        value: true,
        label: "Hijabi friendly",
        evidence,
      }]
    : [];
}

function findHijabiFriendlyEvidence(value = "") {
  const text = htmlToReadableText(value);
  if (!text) {
    return [];
  }

  return [...new Set(
    text
      .split(/\n|\.|•|·|\|/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => /\bhijab(?:i)?[\s-]+friendly\b/i.test(line))
      .filter((line) => line.length >= 4 && line.length <= 180),
  )].slice(0, 4);
}

function adjustDetectedServicesForCurrentContext(detectedServices, currentServices, rawServices) {
  const naturalColourServices = ["Full head colour", "Balayage", "Highlights"];
  const hasNaturalColourDetection = detectedServices.some((service) => naturalColourServices.includes(service));
  const hasExistingWigColour = currentServices.includes("Wig colouring / bundle colouring");
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
    "Wig colouring / bundle colouring",
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
  "Wig colouring / bundle colouring": ["wig colour", "wig color", "wig colouring service", "hair bundle colouring service", "lace closure colouring", "lace frontal colouring", "colouring full wig", "custom colour", "colour service", "613", "non-contact", "non contact", "bundle", "bundles", "frontal", "closure"],
  "Custom wig": ["custom wig", "bespoke wig", "custom lace", "custom unit", "customised closure unit", "customized closure unit", "custom mini frontal unit", "unit customisation", "unit customization", "wig making", "wig construction", "construction of wig", "construction of the wig", "wig customising", "wig customisation", "wig customization", "construction and customisation", "construction and customization"],
  "Feed-in braids": ["feed in", "feed-in", "all back", "braids going back", "cornrows incl extensions", "cornrows including extensions", "cornrows with extensions", "pre pulled packets", "pre-pulled packets"],
  "K-tips / invisible strands": ["k tips", "k-tips", "keratin tip", "keratin tips", "keratin bonds", "invisible strands"],
  "Wig install (frontal / closure)": ["wig install", "wig installation", "wig application", "wig fitting", "glueless wig", "lace wig", "frontal wig", "closure wig", "wig frontal install", "wig closure install", "lace frontal installation", "lace closure installation", "frontal unit", "closure unit", "ready-made unit", "ready made unit", "unit install", "frontal unit install", "closure unit install"],
  "Pixie wig / weave install": ["pixie wig", "pixie weave", "pixie install", "pixie cut wig making", "pixie cut wig making styling"],
  "Tracks (+ silk press) / partial / invisible sew-in": ["tracks", "track per row", "per track", "per row", "one row", "individual sewn on track", "individual sewn on tracks", "tracks add on", "tracks add-on", "silk press add on tracks", "silk press add-on tracks", "sew in tracks", "sew-in tracks", "weave tracks", "single track weave"],
  "Twists (with extensions)": ["twists with extensions", "passion twists", "marley twists", "senegalese twists", "kinky twists", "rope twists", "island twists", "island twist", "large twist", "large twists"],
  "Wash & blowdry": ["wash blowdry", "wash blow dry", "wash and blowdry", "wash and blow dry", "washing blow drying", "washing and blow drying", "shampoo blowdry", "shampoo blow dry", "shampoo and blowdry", "shampoo and blow dry", "blowout"],
  "Japanese head spa": ["japanese head spa", "head spa", "headspa"],
  "Wig cornrows": ["under wig", "wig cornrows", "wig cainrows", "cornrows for wig installation", "cornrows without extensions", "cainrows"],
  "Scalp detox / treatments": ["scalp", "scalp care", "scalp therapy", "scalp treatment", "scalp treatments", "scalp scrub", "scalp detox", "scalp rejuvenation", "scalp renewal", "exfoliating scalp salt scrub"],
};

function serviceFamilyFor(service) {
  if (["Full head colour", "Balayage", "Highlights", "Wig colouring / bundle colouring"].includes(service)) {
    return "colour";
  }
  if (["Custom wig", "Wig install (frontal / closure)", "U-part wig install", "Pixie wig / weave install"].includes(service)) {
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
      result.profileText = [
        profileData?.data?.user?.full_name,
        profileData?.data?.user?.biography,
        profileData?.data?.user?.bio_links?.map((link) => link?.title).filter(Boolean).join(" "),
      ].filter(Boolean).join("\n");
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

  const { responseText, profileText, ...rest } = linkCheck;
  return rest;
}

function isActionableBrokenLink(linkCheck) {
  return linkCheck?.status === "broken" && (linkCheck.httpStatus === 404 || linkCheck.httpStatus === 410);
}

function isManualCheckLink(linkCheck) {
  if (!linkCheck || linkCheck.status === "ok" || isActionableBrokenLink(linkCheck)) {
    return false;
  }

  if (linkCheck.type === "instagram" && linkCheck.status === "unverified" && !(linkCheck.issues || []).length) {
    return false;
  }

  return true;
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

async function extractBestServiceCheck({ booking = "", website = "", bookingUrl = "", websiteUrl = "", allowAiFallback = false } = {}) {
  const primaryCheck = booking ? extractBookingServicesFromHtml(booking) : emptyServiceCheck();
  if (!allowAiFallback || primaryCheck.confidence === "medium" || primaryCheck.confidence === "high") {
    return primaryCheck;
  }

  const aiCheck = await extractAiServiceFallbackCheck({
    text: buildAiServiceFallbackText({ booking, website, bookingUrl, websiteUrl }),
    sourceUrl: bookingUrl || websiteUrl,
  });
  if (aiCheck.confidence === "unknown") {
    return primaryCheck;
  }

  return mergeServiceChecks(primaryCheck, aiCheck);
}

function mergeServiceChecks(primaryCheck = emptyServiceCheck(), fallbackCheck = emptyServiceCheck()) {
  const rawServices = [...new Set([
    ...toArray(primaryCheck.rawServices),
    ...toArray(fallbackCheck.rawServices),
  ])].slice(0, 80);
  const matchedServices = normalizeServices([
    ...toArray(primaryCheck.matchedServices),
    ...toArray(fallbackCheck.matchedServices),
    ...matchServices(rawServices),
  ]);
  const confidenceRank = { unknown: 0, low: 1, medium: 2, high: 3 };
  const fallbackConfidence = fallbackCheck.confidence === "high" && matchedServices.length < 3 ? "medium" : fallbackCheck.confidence;
  const confidence = confidenceRank[primaryCheck.confidence] >= confidenceRank[fallbackConfidence]
    ? primaryCheck.confidence
    : fallbackConfidence;

  return {
    confidence: confidence || "unknown",
    rawServices,
    matchedServices,
    areaId: primaryCheck.areaId || fallbackCheck.areaId || "",
    areaLabel: primaryCheck.areaLabel || fallbackCheck.areaLabel || "",
    source: fallbackCheck.source || primaryCheck.source || "",
  };
}

async function extractBestPriceCheck({ booking = "", website = "", bookingUrl = "", websiteUrl = "", allowAiFallback = false } = {}) {
  const freshaCheck = await extractFreshaPriceCheck(booking, bookingUrl);
  if (freshaCheck.confidence !== "unknown") {
    return freshaCheck;
  }

  const booksyCheck = extractBooksyPriceCheck(booking, bookingUrl);
  if (booksyCheck.confidence !== "unknown") {
    return booksyCheck;
  }

  const setmoreCheck = extractSetmorePriceCheck(booking, bookingUrl);
  if (setmoreCheck.confidence !== "unknown") {
    return setmoreCheck;
  }

  const treatwellCheck = extractTreatwellPriceCheck(booking, bookingUrl);
  if (treatwellCheck.confidence !== "unknown") {
    return treatwellCheck;
  }

  const squareCheck = extractSquarePriceCheck(booking, bookingUrl);
  if (squareCheck.confidence !== "unknown") {
    return squareCheck;
  }

  const salonIqCheck = await extractSalonIqPriceCheck(bookingUrl);
  if (salonIqCheck.confidence !== "unknown") {
    return salonIqCheck;
  }

  const phorestCheck = await extractPhorestPriceCheck(bookingUrl);
  if (phorestCheck.confidence !== "unknown") {
    return phorestCheck;
  }

  const acuityEmbedCheck = await extractAcuityEmbedPriceCheck(booking || website, bookingUrl || websiteUrl);
  if (acuityEmbedCheck.confidence !== "unknown") {
    return acuityEmbedCheck;
  }

  const embeddedPlatformCheck = extractEmbeddedBookingPlatformPriceCheck(booking, bookingUrl);
  if (embeddedPlatformCheck.confidence !== "unknown") {
    return embeddedPlatformCheck;
  }

  const bookingCheck = extractPriceCheckFromHtml(booking, "booking", bookingUrl);
  if (bookingCheck.confidence !== "unknown") {
    return bookingCheck;
  }

  const websiteCheck = extractPriceCheckFromHtml(website, "website", websiteUrl);
  if (websiteCheck.confidence !== "unknown") {
    return websiteCheck;
  }

  const browserCheck = await extractBrowserBackedPriceCheck({ bookingUrl, websiteUrl, allowAiFallback });
  if (browserCheck.confidence !== "unknown") {
    return browserCheck;
  }

  if (allowAiFallback) {
    const investigativeCheck = await extractInvestigativeAiPriceCheck({ bookingUrl, websiteUrl });
    if (investigativeCheck.confidence !== "unknown") {
      return investigativeCheck;
    }
    return extractAiPriceFallbackCheck({
      text: buildAiPriceFallbackText({ booking, website, bookingUrl, websiteUrl }),
      sourceUrl: bookingUrl || websiteUrl,
    });
  }

  return browserCheck;
}

async function fetchEmbeddedBookingSources(sources = []) {
  const urls = [];
  const sourceUrls = new Set(sources.map((source) => normalizeUrlForComparison(source.url)).filter(Boolean));
  sources.forEach((source) => {
    extractEmbeddedBookingUrls(source.html, source.url).forEach((url) => {
      const normalized = normalizeUrlForComparison(url);
      if (normalized && !sourceUrls.has(normalized)) {
        urls.push(url);
      }
    });
  });

  const uniqueUrls = [...new Set(urls.map((url) => normalizeBookingUrl(url)).filter(Boolean))].slice(0, 4);
  const embeddedSources = [];
  for (const url of uniqueUrls) {
    try {
      const linkCheck = await checkUrl("booking", url, { includeText: true });
      if (linkCheck.status === "ok" && linkCheck.responseText) {
        embeddedSources.push({ url: linkCheck.finalUrl || url, html: linkCheck.responseText, linkCheck });
      }
    } catch {
      // Embedded booking widgets are best-effort; keep the parent page result if they fail.
    }
  }
  return embeddedSources;
}

async function extractBrowserBackedPriceCheck({ bookingUrl = "", websiteUrl = "", allowAiFallback = false } = {}) {
  const candidateUrls = [...new Set([bookingUrl, websiteUrl].filter(Boolean).flatMap(expandBrowserPriceCheckUrls))]
    .filter((url) => isBrowserBackedPriceCheckUrl(url))
    .slice(0, 3);

  for (const url of candidateUrls) {
    try {
      const check = await extractBrowserRenderedPriceCheck(url, { allowAiFallback });
      if (check.confidence !== "unknown") {
        return check;
      }
    } catch {
      // Browser fallback is intentionally best-effort; keep pricing checks moving.
    }
  }

  return emptyPriceCheck("browser");
}

function expandBrowserPriceCheckUrls(url = "") {
  const urls = [url];
  const parsed = safeUrl(url);
  if (!parsed) {
    return urls;
  }

  const phorestMatch = parsed.pathname.match(/\/salon\/([^/?#]+)/i);
  if (safeHost(url).endsWith("phorest.com") && phorestMatch) {
    urls.push(`https://www.phorest.com/salon/${phorestMatch[1]}/book/service-selection?showSpecialOffers=false`);
  }
  const phorestBookMatch = parsed.pathname.match(/\/book\/salons\/([^/?#]+)/i);
  if (safeHost(url).endsWith("phorest.com") && phorestBookMatch) {
    urls.push(`https://www.phorest.com/salon/${phorestBookMatch[1]}/book/service-selection?showSpecialOffers=false`);
  }
  const phorestLocationMatch = parsed.pathname.match(/\/salon\/([^/?#]+)\/locations/i);
  if (safeHost(url).endsWith("phorest.com") && phorestLocationMatch) {
    urls.push(`https://www.phorest.com/salon/${phorestLocationMatch[1]}/book/service-selection?showSpecialOffers=false`);
  }
  if (safeHost(url).endsWith("vagaro.com") && !/\/services(?:\/|$)/i.test(parsed.pathname)) {
    urls.push(`${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}/services`);
  }

  return urls;
}

function isBrowserBackedPriceCheckUrl(url = "") {
  const host = safeHost(url);
  return host.endsWith("vagaro.com")
    || host.endsWith("phorest.com")
    || host.endsWith("gettimely.com")
    || host.endsWith("zenoti.com")
    || host.endsWith("getslick.com")
    || host.endsWith("slick.fyi")
    || host.endsWith("square.site")
    || host.endsWith("squareup.com")
    || host.endsWith("s-iq.co");
}

async function extractBrowserRenderedPriceCheck(url = "", { allowAiFallback = false } = {}) {
  const browser = await getPriceCheckBrowser();
  const page = await browser.newPage({
    userAgent: browserUserAgent,
    viewport: { width: 1365, height: 900 },
  });
  const responseEntries = [];

  page.on("response", async (response) => {
    try {
      const responseUrl = response.url();
      if (!/vagaro|phorest|service|booking|api/i.test(responseUrl)) {
        return;
      }
      const contentType = response.headers()["content-type"] || "";
      if (!/json|html|text/i.test(contentType)) {
        return;
      }
      const body = await response.text();
      if (!/£|&pound;|price|service|fromPrice|totalPrice|Price|ServiceTitle|service_categories/i.test(body)) {
        return;
      }
      responseEntries.push(...extractBrowserPayloadPriceEntries(body));
    } catch {
      // Some responses cannot be read by Playwright; ignore them.
    }
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 18_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await clickLikelyBookingControls(page, url);
    await page.waitForTimeout(2_000);

    const renderedText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const renderedHtml = await page.content().catch(() => "");
    const renderedEntries = [
      ...extractBrowserPayloadPriceEntries(renderedHtml),
      ...extractPriceEntries(renderedText, { consultationFocused: isConsultationFocusedPricePage(renderedText, url) }),
    ];
    const safeResponseEntries = safeHost(url).endsWith("vagaro.com") ? [] : responseEntries;
    const uniqueEntries = uniquePriceEntries([...safeResponseEntries, ...renderedEntries]);
    if (uniqueEntries.length) {
      return {
        ...buildPriceCheckFromEntries(uniqueEntries.slice(0, 80), "browser", { structured: uniqueEntries.some((entry) => entry.structured) }),
        source: "browser",
      };
    }
    if (allowAiFallback) {
      return await extractAiPriceFallbackCheck({
        text: buildAiPriceFallbackText({ renderedText, renderedHtml, bookingUrl: url }),
        sourceUrl: url,
      });
    }
  } finally {
    await page.close().catch(() => {});
  }

  return emptyPriceCheck("browser");
}

async function clickLikelyBookingControls(page, url = "") {
  if (safeHost(url).endsWith("phorest.com")) {
    await page.getByText(/Continue without Accepting|Accept All Cookies/i).click({ timeout: 2_000 }).catch(() => {});
    await clickMatchingBrowserElements(page, /\b(colou?r|hair|extension|natural|relax|treatment|wash|style|service|braid|loc|wig|weave|cut)\b/i, 30);
    return;
  }

  if (safeHost(url).endsWith("vagaro.com")) {
    const selectors = [
      "text=/services/i",
      "text=/book now/i",
      "text=/book/i",
    ];
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.count().catch(() => 0)) {
        await locator.click({ timeout: 2_000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => {});
      }
    }
    await clickMatchingBrowserElements(page, /\b(braid|braids|loc|locs|wig|weave|sew|silk|press|colour|color|cut|barber|hair|extension|treatment|relax|style)\b/i, 40);
  }
}

async function clickMatchingBrowserElements(page, pattern, limit = 25, options = {}) {
  const {
    allowBookNow = false,
    collectSnapshots = null,
    snapshotLabel = "after click",
  } = options;
  const locator = page.locator('[role="button"], button, a');
  const count = Math.min(await locator.count().catch(() => 0), limit);
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    const label = (await item.innerText({ timeout: 500 }).catch(() => "")).replace(/\s+/g, " ").trim();
    if (!label || !pattern.test(label) || (!allowBookNow && /^book now$/i.test(label)) || isUnsafeBrowserClickLabel(label)) {
      continue;
    }
    await item.click({ timeout: 1_500 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(350);
    if (collectSnapshots) {
      await collectBrowserPriceSnapshot(page, collectSnapshots, `${snapshotLabel}: ${label}`);
    }
  }
  await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => {});
}

function isUnsafeBrowserClickLabel(label = "") {
  return /\b(pay|checkout|confirm|place order|complete booking|buy now|add to cart|basket|subscribe|log ?in|sign ?in|register|create account)\b/i.test(label);
}

function extractBrowserPayloadPriceEntries(value = "") {
  const raw = decodeHtmlEntities(String(value || ""))
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0022/g, "\"")
    .replace(/\\\//g, "/");
  const entries = [
    ...extractRawPayloadPriceEntries(raw),
    ...extractEmbeddedJsonObjects(raw).flatMap((data) => extractPriceEntriesFromArbitraryData(data)),
    ...extractPriceEntries(htmlToReadableText(raw), { consultationFocused: false }),
  ];
  return uniquePriceEntries(entries);
}

function uniquePriceEntries(entries = []) {
  const unique = [];
  const seen = new Set();
  entries.forEach((entry) => {
    if (!entry || !Number.isFinite(entry.value)) {
      return;
    }
    const key = `${entry.value}:${entry.evidence}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  });
  return unique;
}

async function extractInvestigativeAiPriceCheck({ bookingUrl = "", websiteUrl = "" } = {}) {
  if (!isAiPriceFallbackEnabled()) {
    return emptyPriceCheck("ai-browser");
  }
  const urls = [...new Set([bookingUrl, websiteUrl].filter((url) => url && !isSocialOnlyUrl(url)).flatMap(expandBrowserPriceCheckUrls))]
    .filter((url) => safeUrl(url))
    .slice(0, 3);
  if (!urls.length) {
    return emptyPriceCheck("ai-browser");
  }

  for (const url of urls) {
    try {
      const investigation = await investigatePricePageWithBrowser(url);
      const directEntries = uniquePriceEntries(investigation.priceEntries);
      if (directEntries.length) {
        return {
          ...buildPriceCheckFromEntries(directEntries.slice(0, 80), "browser", { structured: directEntries.some((entry) => entry.structured) }),
          source: "browser",
        };
      }
      const check = await extractAiPriceFallbackCheck({
        text: investigation.text,
        sourceUrl: url,
      });
      if (check.confidence !== "unknown") {
        return {
          ...check,
          source: "ai-browser",
        };
      }
    } catch (error) {
      console.warn(`Investigative price crawl failed for ${url}: ${error.message}`);
    }
  }

  return emptyPriceCheck("ai-browser");
}

async function investigatePricePageWithBrowser(url = "") {
  const browser = await getPriceCheckBrowser();
  const page = await browser.newPage({
    userAgent: browserUserAgent,
    viewport: { width: 1365, height: 900 },
  });
  const snapshots = [];
  const responseEntries = [];

  page.on("response", async (response) => {
    try {
      const responseUrl = response.url();
      if (!/service|price|booking|appointment|treatment|api|schedule|phorest|vagaro|timely|square|acuity|as\.me|zenoti|slick|tress|jena/i.test(responseUrl)) {
        return;
      }
      const contentType = response.headers()["content-type"] || "";
      if (!/json|html|text/i.test(contentType)) {
        return;
      }
      const body = await response.text();
      if (!/£|&pound;|gbp|price|service|treatment|booking/i.test(body)) {
        return;
      }
      responseEntries.push(...extractBrowserPayloadPriceEntries(body));
    } catch {
      // Ignore unreadable browser responses.
    }
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 18_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await collectBrowserPriceSnapshot(page, snapshots, "initial page");
    await clickCookieControls(page);

    const likelyLinks = await extractLikelyBrowserPriceLinks(page, url);
    for (const link of likelyLinks.slice(0, 5)) {
      if (isNonPageAssetUrl(link)) {
        continue;
      }
      await page.goto(link, { waitUntil: "domcontentloaded", timeout: 14_000 }).catch(() => null);
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await collectBrowserPriceSnapshot(page, snapshots, `visited ${link}`);
      await clickInvestigativeBrowserControls(page, snapshots, link);
    }

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 14_000 }).catch(() => null);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await clickInvestigativeBrowserControls(page, snapshots, url);

    const snapshotText = snapshots.join("\n\n---\n\n");
    const snapshotEntries = extractPriceEntries(snapshotText, { consultationFocused: isConsultationFocusedPricePage(snapshotText, url) });
    return {
      text: buildAiPriceFallbackText({ renderedText: snapshotText, bookingUrl: url }),
      priceEntries: uniquePriceEntries([...responseEntries, ...snapshotEntries]),
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function collectBrowserPriceSnapshot(page, snapshots, label = "") {
  const url = page.url();
  const text = await page.locator("body").innerText({ timeout: 4_000 }).catch(() => "");
  const cleaned = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned || !/(£|gbp|price|service|treatment|book|appointment|braid|loc|wig|weave|hair)/i.test(cleaned)) {
    return;
  }
  snapshots.push(`SNAPSHOT: ${label}\nURL: ${url}\n${cleaned.slice(0, 6000)}`);
}

async function clickCookieControls(page) {
  const labels = /accept all|accept cookies|continue without accepting|reject all|allow all/i;
  await clickMatchingBrowserElements(page, labels, 8, { allowBookNow: true, collectSnapshots: null, snapshotLabel: "" });
}

async function clickInvestigativeBrowserControls(page, snapshots, url = "") {
  await clickLikelyBookingControls(page, url);
  await collectBrowserPriceSnapshot(page, snapshots, "after platform controls");
  await clickMatchingBrowserElements(
    page,
    /\b(book now|book|services?|treatments?|prices?|pricing|menu|appointments?|schedule|select|continue|next|hair|braid|braids|loc|locs|wig|weave|sew|silk|press|colour|color|cut|extension|treatment|relax|style)\b/i,
    45,
    { allowBookNow: true, collectSnapshots: snapshots, snapshotLabel: "after click" },
  );
}

async function extractLikelyBrowserPriceLinks(page, baseUrl = "") {
  const links = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => ({
    href: anchor.href,
    label: anchor.textContent || "",
  }))).catch(() => []);
  const baseHost = safeHost(baseUrl);
  const scored = links
    .map((link) => {
      const href = cleanString(link.href);
      const label = cleanPriceEvidenceText(link.label || "");
      if (!href || isSocialOnlyUrl(href) || isNonPageAssetUrl(href)) {
        return null;
      }
      const host = safeHost(href);
      const sameSite = host === baseHost || host.endsWith(`.${baseHost}`);
      const knownBooking = isKnownStructuredBookingUrl(href);
      if (!sameSite && !knownBooking) {
        return null;
      }
      const haystack = `${href} ${label}`;
      const score = [
        /price|pricing|prices/i,
        /service|services|treatment|treatments/i,
        /book|booking|appointment|schedule/i,
        /hair|braid|loc|wig|weave|silk|colour|color/i,
      ].reduce((total, pattern) => total + (pattern.test(haystack) ? 1 : 0), 0);
      return score ? { href, score } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);
  return [...new Set(scored.map((link) => normalizeBookingUrl(link.href)).filter(Boolean))].slice(0, 8);
}

function isNonPageAssetUrl(url = "") {
  try {
    const parsed = new URL(url);
    return /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|css|js|woff2?|ttf|eot)(?:$|\?)/i.test(parsed.pathname);
  } catch {
    return true;
  }
}

function buildAiPriceFallbackText({ booking = "", website = "", renderedText = "", renderedHtml = "", bookingUrl = "", websiteUrl = "" } = {}) {
  const parts = [
    bookingUrl ? `BOOKING URL: ${bookingUrl}` : "",
    websiteUrl ? `WEBSITE URL: ${websiteUrl}` : "",
    renderedText ? `RENDERED PAGE TEXT:\n${renderedText}` : "",
    booking ? `BOOKING PAGE TEXT:\n${htmlToReadableText(booking)}` : "",
    website ? `WEBSITE PAGE TEXT:\n${htmlToReadableText(website)}` : "",
    renderedHtml && !renderedText ? `RENDERED HTML TEXT:\n${htmlToReadableText(renderedHtml)}` : "",
  ].filter(Boolean);

  return parts.join("\n\n").replace(/\s+\n/g, "\n").slice(0, 20_000);
}

function buildAiServiceFallbackText({ booking = "", website = "", renderedText = "", bookingUrl = "", websiteUrl = "" } = {}) {
  const parts = [
    bookingUrl ? `BOOKING URL: ${bookingUrl}` : "",
    websiteUrl ? `WEBSITE URL: ${websiteUrl}` : "",
    renderedText ? `RENDERED PAGE TEXT:\n${renderedText}` : "",
    booking ? `BOOKING PAGE TEXT:\n${htmlToReadableText(booking)}` : "",
    website ? `WEBSITE PAGE TEXT:\n${htmlToReadableText(website)}` : "",
  ].filter(Boolean);

  return parts.join("\n\n").replace(/\s+\n/g, "\n").slice(0, 20_000);
}

async function extractAiServiceFallbackCheck({ text = "", sourceUrl = "" } = {}) {
  const inputText = cleanString(text);
  if (!isAiServiceFallbackEnabled() || !/(service|appointment|book|treatment|braid|loc|wig|weave|hair|install|silk|press|extension)/i.test(inputText)) {
    return emptyServiceCheck();
  }

  try {
    const response = await fetchOpenAiServiceExtraction(inputText, sourceUrl);
    const rawServices = sanitizeAiServiceNames(response?.services || []);
    const matchedServices = matchServices(rawServices);
    if (!rawServices.length || !matchedServices.length) {
      return emptyServiceCheck();
    }

    const modelConfidence = sanitizeAiServiceConfidence(response?.confidence) || "low";
    return {
      confidence: modelConfidence === "high" && rawServices.length >= 5 && matchedServices.length >= 2
        ? "high"
        : rawServices.length >= 3
          ? "medium"
          : "low",
      rawServices: rawServices.slice(0, 80),
      matchedServices,
      areaId: "",
      areaLabel: "",
      source: "ai",
    };
  } catch (error) {
    console.warn(`AI service fallback failed${sourceUrl ? ` for ${sourceUrl}` : ""}: ${error.message}`);
    return emptyServiceCheck();
  }
}

async function extractAiPriceFallbackCheck({ text = "", sourceUrl = "" } = {}) {
  const inputText = cleanString(text);
  if (!isAiPriceFallbackEnabled() || !/(£|gbp|british pounds?|pounds?|\bprice\b)/i.test(inputText)) {
    return emptyPriceCheck("ai");
  }

  try {
    const response = await fetchOpenAiPriceExtraction(inputText, sourceUrl);
    const entries = sanitizeAiPriceEntries(response?.servicePrices || []);
    if (!entries.length) {
      return emptyPriceCheck("ai");
    }

    const modelConfidence = sanitizePriceConfidence(response?.confidence) || "low";
    const priceCheck = buildPriceCheckFromEntries(entries, "ai", { structured: true });
    const confidence = modelConfidence === "high" && entries.length >= 6
      ? "high"
      : entries.length >= 3
        ? "medium"
        : "low";
    return {
      ...priceCheck,
      source: "ai",
      confidence,
      evidence: entries.slice(0, 8).map((entry) => entry.evidence),
    };
  } catch (error) {
    console.warn(`AI price fallback failed${sourceUrl ? ` for ${sourceUrl}` : ""}: ${error.message}`);
    return emptyPriceCheck("ai");
  }
}

function isAiPriceFallbackEnabled() {
  return Boolean(getOpenAiApiKey());
}

function isAiServiceFallbackEnabled() {
  return Boolean(getOpenAiApiKey());
}

function getOpenAiApiKey() {
  return cleanString(process.env.OPENAI_API_KEY || process.env.ROWK_OPENAI_API_KEY);
}

function getOpenAiPriceModel() {
  return cleanString(process.env.OPENAI_PRICE_MODEL || process.env.OPENAI_MODEL) || "gpt-4.1-mini";
}

async function fetchOpenAiPriceExtraction(text, sourceUrl = "") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getOpenAiApiKey()}`,
      },
      body: JSON.stringify({
        model: getOpenAiPriceModel(),
        instructions: [
          "Extract GBP hair-service prices from booking-page text for an admin pricing check.",
          "Return only real bookable service prices.",
          "Exclude consultations, deposits, discounts, vouchers, add-ons, extra charges, Sunday charges, cancellation/late/no-show fees, gift cards, courses/classes, products, and per-bundle/per-track/per-row component prices.",
          "If a range is shown, use the midpoint. If a price says From £X for a real service, use X.",
          "Do not infer prices that are not in the text.",
          "Return at most 80 servicePrices, prioritising distinct real services.",
        ].join(" "),
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: `Source URL: ${sourceUrl || "unknown"}\n\nPage text:\n${text.slice(0, 20_000)}`,
          }],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "hair_service_price_extraction",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                servicePrices: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      serviceName: { type: "string" },
                      price: { type: "number" },
                      evidence: { type: "string" },
                    },
                    required: ["serviceName", "price", "evidence"],
                  },
                },
                notes: { type: "string" },
              },
              required: ["confidence", "servicePrices", "notes"],
            },
          },
        },
        max_output_tokens: 8000,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error?.message || `OpenAI API returned ${response.status}`);
    }
    const outputText = getOpenAiResponseText(body);
    return JSON.parse(outputText);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOpenAiServiceExtraction(text, sourceUrl = "") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getOpenAiApiKey()}`,
      },
      body: JSON.stringify({
        model: getOpenAiPriceModel(),
        instructions: [
          "Extract bookable hair-service names from booking-page or salon website text for a Row K health check.",
          "Return only real client services, treatments, installs, maintenance, classes, or consultations that appear in the text.",
          "Do not extract prices, price bands, package classification, fees, deposits, add-ons, products, policies, durations, staff names, or marketing claims.",
          "Do not infer services that are not present in the text.",
          "Keep service names concise and close to the wording on the page.",
          "Return at most 80 services, prioritising distinct real services.",
        ].join(" "),
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: `Source URL: ${sourceUrl || "unknown"}\n\nPage text:\n${text.slice(0, 20_000)}`,
          }],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "hair_service_name_extraction",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                services: {
                  type: "array",
                  items: { type: "string" },
                },
                notes: { type: "string" },
              },
              required: ["confidence", "services", "notes"],
            },
          },
        },
        max_output_tokens: 4000,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error?.message || `OpenAI API returned ${response.status}`);
    }
    const outputText = getOpenAiResponseText(body);
    return JSON.parse(outputText);
  } finally {
    clearTimeout(timeout);
  }
}

function getOpenAiResponseText(response = {}) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  const chunks = [];
  (response.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    });
  });
  return chunks.join("\n").trim();
}

function sanitizeAiPriceEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const serviceName = cleanPriceEvidenceText(entry?.serviceName || "");
      const evidence = cleanPriceEvidenceText(entry?.evidence || serviceName);
      const value = Number(entry?.price);
      const evidenceText = evidence || serviceName;
      if (!Number.isFinite(value) || value < 10 || value > 5000) {
        return null;
      }
      if (!isLikelyServicePriceContext(serviceName || evidenceText) || isNonServicePriceLine(`${serviceName} ${evidenceText}`)) {
        return null;
      }
      return {
        value,
        evidence: `${serviceName} - ${evidenceText}`.slice(0, 180),
        hasServiceContext: true,
        structured: true,
      };
    })
    .filter(Boolean)
    .slice(0, 80);
}

function sanitizeAiServiceNames(services = []) {
  return [...new Set((Array.isArray(services) ? services : [])
    .map((service) => cleanPriceEvidenceText(service))
    .filter((service) => service && service.length >= 3 && service.length <= 120)
    .filter((service) => !/(^|\b)(price|prices|pricing|deposit|fee|policy|duration|book now|select|show all|add-ons?|discount|voucher|gift card)(\b|$)/i.test(service))
  )];
}

function sanitizeAiServiceConfidence(value = "") {
  const cleaned = cleanString(value).toLowerCase();
  return ["high", "medium", "low"].includes(cleaned) ? cleaned : "";
}

async function getPriceCheckBrowser() {
  if (!priceCheckBrowserPromise) {
    priceCheckBrowserPromise = import("playwright")
      .then(({ chromium }) => chromium.launch({ headless: true }))
      .catch((error) => {
        priceCheckBrowserPromise = null;
        throw error;
      });
  }
  return priceCheckBrowserPromise;
}

function combineBookingHtml(primaryHtml = "", embeddedSources = []) {
  return [primaryHtml, ...embeddedSources.map((source) => source.html)].filter(Boolean).join("\n");
}

function extractEmbeddedBookingUrls(html = "", baseUrl = "") {
  if (!html) {
    return [];
  }
  const decodedHtml = decodeHtmlEntities(String(html));
  const urls = [];
  const attributeRegex = /\b(?:src|href|data-acuity-url|data-url|data-src|data-booking-url|data-scheduling-url)=["']([^"']+)["']/gi;
  let match;
  while ((match = attributeRegex.exec(decodedHtml)) !== null) {
    urls.push(resolveEmbeddedBookingUrl(match[1], baseUrl));
  }

  const rawUrlRegex = /https?:\/\/[^\s"'<>\\]+/gi;
  while ((match = rawUrlRegex.exec(decodedHtml)) !== null) {
    urls.push(resolveEmbeddedBookingUrl(match[0], baseUrl));
  }

  const acuityUserMatch = decodedHtml.match(/data-user-id=["'](\d+)["']/i);
  const acuityUrlMatch = decodedHtml.match(/data-acuity-url=["']([^"']+)["']/i);
  if (acuityUrlMatch) {
    const acuityUrl = resolveEmbeddedBookingUrl(acuityUrlMatch[1], baseUrl);
    if (!/squarespace-example\.as\.me/i.test(acuityUrl)) {
      urls.push(acuityUrl);
    }
  }
  if (acuityUserMatch) {
    urls.push(`https://app.acuityscheduling.com/schedule.php?owner=${acuityUserMatch[1]}`);
  }

  const timelyButtonRegex = /new\s+timelyButton\(["']([^"']+)["'](?:\s*,\s*(\{[\s\S]{0,500}?\}))?\)/gi;
  while ((match = timelyButtonRegex.exec(decodedHtml)) !== null) {
    const slug = cleanString(match[1]);
    if (slug) {
      urls.push(`https://bookings.gettimely.com/${encodeURIComponent(slug)}/book`);
    }
  }

  return [...new Set(urls.filter((url) => url && isKnownStructuredBookingUrl(url) && !isSocialOnlyUrl(url)))];
}

function resolveEmbeddedBookingUrl(value = "", baseUrl = "") {
  const cleaned = cleanString(value).replace(/\\\//g, "/");
  if (!cleaned || /^javascript:|^mailto:|^tel:/i.test(cleaned)) {
    return "";
  }
  try {
    return new URL(cleaned, baseUrl || undefined).toString();
  } catch {
    return "";
  }
}

function normalizeBookingUrl(url = "") {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeUrlForComparison(url = "") {
  return normalizeBookingUrl(url).replace(/\/+$/, "").toLowerCase();
}

function decodeHtmlEntities(value = "") {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cookieHeaderFromSetCookie(setCookie = "") {
  return String(setCookie || "")
    .split(/,\s*(?=[^;,]+=)/)
    .map((cookie) => cookie.trim().split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function extractDirectSiteFallbackPriceCheck({ bookingHtml = "", websiteHtml = "", bookingUrl = "", websiteUrl = "", allowAiFallback = false } = {}) {
  const directSources = [
    { html: bookingHtml, url: bookingUrl },
    { html: websiteHtml, url: websiteUrl },
  ].filter((source) => source.html && source.url && !isKnownStructuredBookingUrl(source.url));

  const candidateUrls = [];
  directSources.forEach((source) => {
    candidateUrls.push(...extractLikelyPricingPageUrls(source.html, source.url));
  });

  const uniqueUrls = [...new Set(candidateUrls)].slice(0, 4);
  for (const url of uniqueUrls) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        continue;
      }
      const html = await response.text();
      if (!hasStrongPricingPageContext(html, url)) {
        continue;
      }
      const check = extractPriceCheckFromHtml(html, "website", url);
      if (check.confidence !== "unknown") {
        return {
          ...check,
          confidence: check.confidence === "high" ? "medium" : check.confidence,
        };
      }
    } catch {
      // Keep the fallback best-effort; direct sites vary heavily.
    }
  }

  if (allowAiFallback) {
    return extractAiPriceFallbackCheck({
      text: buildAiPriceFallbackText({ booking: bookingHtml, website: websiteHtml, bookingUrl, websiteUrl }),
      sourceUrl: bookingUrl || websiteUrl,
    });
  }

  return emptyPriceCheck("website");
}

function extractLikelyPricingPageUrls(html, baseUrl = "") {
  const base = safeUrl(baseUrl);
  if (!base) {
    return [];
  }
  const urls = [];
  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(String(html || ""))) !== null) {
    const href = cleanString(match[1]);
    const label = cleanPriceEvidenceText(match[2]);
    if (!/(price|pricing|prices|service|services|menu|book|booking|treatment|treatments)/i.test(`${href} ${label}`)) {
      continue;
    }
    try {
      const url = new URL(href, base).toString();
      if (safeHost(url) === base.hostname.replace(/^www\./, "") || safeHost(url).endsWith(`.${base.hostname.replace(/^www\./, "")}`)) {
        urls.push(url);
      }
    } catch {
      // skip invalid links
    }
  }
  return urls;
}

function hasStrongPricingPageContext(html, url = "") {
  const text = htmlToReadableText(html).slice(0, 5000);
  const priceCount = (text.match(/£|&pound;|gbp|british pounds?/gi) || []).length;
  const serviceCount = (text.match(/\b(braid|braids|loc|locs|wig|weave|sew|silk|press|colour|color|cut|trim|wash|blow|treat|keratin|relax|pony|cornrow|closure|frontal|install|twist|texture)\b/gi) || []).length;
  return priceCount >= 3 && serviceCount >= 3 && !isConsultationFocusedPricePage(text, url);
}

function isKnownStructuredBookingUrl(url = "") {
  const host = safeHost(url);
  return /fresha\.com|booksy\.com|setmore\.com|as\.me|acuityscheduling\.com|treatwell\.|s-iq\.co|phorest\.com|phorest\.me|vagaro\.com|gettimely\.com|square|zenoti\.com|getslick\.com|slick\.fyi|tressly\.com|jena/i.test(host);
}

function extractPriceCheckFromHtml(html, source, url = "") {
  if (!html) {
    return emptyPriceCheck(source);
  }

  const text = htmlToReadableText(html);
  const consultationFocused = isConsultationFocusedPricePage(text, url);
  const structuredPriceEntries = extractStructuredPriceEntries(html);
  if (structuredPriceEntries.length) {
    return buildPriceCheckFromEntries(structuredPriceEntries, source);
  }

  const rawPayloadPriceEntries = extractRawPayloadPriceEntries(html);
  if (rawPayloadPriceEntries.length >= 3) {
    return buildPriceCheckFromEntries(rawPayloadPriceEntries, source, { structured: true });
  }

  const priceEntries = extractPriceEntries(text, { consultationFocused });
  if (!priceEntries.length) {
    return emptyPriceCheck(source);
  }

  return buildPriceCheckFromEntries(priceEntries, source);
}

function parseManualPriceText(text = "") {
  const normalizedText = String(text || "").replace(/&pound;/gi, "£").replace(/\bGBP\b/gi, "£");
  const consultationFocused = isConsultationFocusedPricePage(normalizedText, "");
  const entries = extractPriceEntries(normalizedText, { consultationFocused });
  const priceCheck = entries.length ? buildPriceCheckFromEntries(entries, "manual") : emptyPriceCheck("manual");
  return {
    ...priceCheck,
    confidence: entries.length ? "manual" : "unknown",
    ignoredPrices: extractIgnoredManualPriceLines(normalizedText),
  };
}

function buildPriceCheckFromEntries(priceEntries, source, { structured = false } = {}) {
  const normalizedEntries = priceEntries.map((entry) => ({
    ...entry,
    priceKind: entry.priceKind || classifyPriceEntryKind(entry),
  }));
  const serviceEntries = normalizedEntries.filter((entry) => entry.priceKind !== "package");
  const packageEntries = normalizedEntries.filter((entry) => entry.priceKind === "package");
  const values = normalizedEntries.map((entry) => entry.value).sort((left, right) => left - right);
  const servicePrices = serviceEntries.map((entry) => entry.value).sort((left, right) => left - right);
  const packagePrices = packageEntries.map((entry) => entry.value).sort((left, right) => left - right);
  const medianPrice = medianPriceForValues(values);
  const serviceMedianPrice = medianPriceForValues(servicePrices);
  const packageMedianPrice = medianPriceForValues(packagePrices);
  const servicePriceBand = priceBandForValue(serviceMedianPrice);
  const packagePriceBand = priceBandForValue(packageMedianPrice);
  const priceIncludesHair = packageEntries.length > 0;
  const priceComparisonMode = serviceEntries.length && packageEntries.length
    ? "mixed"
    : packageEntries.length
      ? "package-only"
      : serviceEntries.length
        ? "service-only"
        : "";
  const priceBand = servicePriceBand || packagePriceBand || priceBandForValue(medianPrice);
  const structuredEntries = structured || priceEntries.some((entry) => entry.structured);
  const contextualEntries = normalizedEntries.filter((entry) => entry.hasServiceContext || entry.structured).length;
  return {
    source,
    confidence: structuredEntries && normalizedEntries.length >= 6 ? "high" : structuredEntries && normalizedEntries.length >= 2 ? "medium" : contextualEntries >= 3 ? "medium" : normalizedEntries.length >= 3 ? "low" : "unknown",
    priceBand,
    medianPrice,
    prices: values,
    priceCount: normalizedEntries.length,
    evidence: normalizedEntries.slice(0, 8).map((entry) => entry.evidence),
    servicePriceBand,
    serviceMedianPrice,
    servicePrices,
    servicePriceCount: serviceEntries.length,
    packagePriceBand,
    packageMedianPrice,
    packagePrices,
    packagePriceCount: packageEntries.length,
    priceIncludesHair,
    priceComparisonMode,
  };
}

function medianPriceForValues(values = []) {
  return values.length ? values[Math.floor(values.length / 2)] : null;
}

function classifyPriceEntryKind(entry = {}) {
  const normalized = normalizeServiceText([
    entry.evidence,
    entry.priceContext,
    entry.context,
  ].filter(Boolean).join(" "));

  if (hasServiceOnlyPricingSignal(normalized)) {
    return "service";
  }

  if (hasIncludedHairPricingSignal(normalized)) {
    return "package";
  }

  return "service";
}

function hasServiceOnlyPricingSignal(value = "") {
  return /\b(no|without|not)\s+(?:hair|extensions?|bundles?)\s+included\b/.test(value) ||
    /\b(?:hair|extensions?|bundles?)\s+(?:not\s+included|not\s+provided)\b/.test(value) ||
    /\b(?:kindly\s+)?provide\s+\d?[\s-]*(?:to|-)?\s*\d?\s*(?:bundles?|packs?|packets?|extensions?|braiding\s+hair)\b/.test(value) ||
    /\bmust\s+bring\b/.test(value) ||
    /\bbring\s+(?:your\s+own\s+)?(?:hair|extensions?|bundles?|packs?)\b/.test(value) ||
    /\brefresh\b/.test(value) ||
    /\btraditional\s+sew[\s-]*in\b/.test(value) ||
    /\bflip[\s-]*over\s+sew[\s-]*in\b/.test(value);
}

function hasIncludedHairPricingSignal(value = "") {
  return /\b(?:hair|extensions?|bundles?|human\s+hair)\s+(?:is\s+|are\s+)?(?:included|provided)\b/.test(value) ||
    /\b(?:included|provided)\s+(?:hair|extensions?|bundles?|human\s+hair)\b/.test(value) ||
    /\bbundles?\s+included\b/.test(value) ||
    /\bhair\s+included\b/.test(value) ||
    /\bextensions?\s+included\b/.test(value) ||
    /\bextensions?\s+provided\b/.test(value) ||
    /\bprovided\s+will\s+be\b/.test(value) ||
    /\b(?:\d+\s*[x*]?\s*)?(?:\d{2}\s*inch\s+)?(?:human\s+hair\s+)?bundles?\s+(?:will\s+be\s+)?(?:used|included|provided)\b/.test(value);
}

function extractRawPayloadPriceEntries(html = "") {
  const raw = decodeHtmlEntities(String(html || ""))
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0022/g, "\"")
    .replace(/\\\//g, "/");
  const entries = [];

  const objectPriceRegex = /"(?<nameKey>name|title|serviceName|service_name|displayName|display_name|ServiceTitle|ServiceName)"\s*:\s*"(?<name>[^"]{3,160})"(?<middle>[\s\S]{0,2500}?)"(?<priceKey>price_cents|priceCents|price|Price|amount|Amount|cost|Cost|salePrice|price_description|priceDescription)"\s*:\s*"?(?<price>[^",}\]]+)"?/gi;
  let match;
  while ((match = objectPriceRegex.exec(raw)) !== null) {
    const name = cleanPriceEvidenceText(match.groups?.name || "");
    const priceKey = match.groups?.priceKey || "";
    const price = parsePayloadPrice(match.groups?.price, priceKey, match.groups?.middle || "");
    addRawPayloadPriceEntry(entries, name, price);
  }

  const reactPriceRegex = /"children"\s*:\s*"(?<name>[^"]{3,120})"(?<middle>[\s\S]{0,900}?)"children"\s*:\s*\[\s*"£"\s*,\s*(?<price>[0-9]{1,4}(?:\.[0-9]{1,2})?)\s*\]/gi;
  while ((match = reactPriceRegex.exec(raw)) !== null) {
    addRawPayloadPriceEntry(entries, cleanPriceEvidenceText(match.groups?.name || ""), parsePayloadPrice(match.groups?.price, "price"));
  }

  const visibleCardRegex = /<h[1-6][^>]*>(?<name>[\s\S]{3,180}?)<\/h[1-6]>(?<middle>[\s\S]{0,1200}?)(?:Price\s*:?\s*)?(?:From\s*)?£\s*(?<price>[0-9]{1,4}(?:[,.][0-9]{1,2})?)/gi;
  while ((match = visibleCardRegex.exec(raw)) !== null) {
    addRawPayloadPriceEntry(entries, cleanPriceEvidenceText(match.groups?.name || ""), parsePayloadPrice(match.groups?.price, "price"));
  }

  const unique = new Map();
  entries.forEach((entry) => {
    unique.set(`${entry.value}:${entry.evidence}`, entry);
  });
  return [...unique.values()].slice(0, 80);
}

function addRawPayloadPriceEntry(entries, label, price) {
  const cleanedLabel = cleanPriceEvidenceText(label);
  const evidenceText = cleanedLabel;
  if (!Number.isFinite(price) || !isLikelyServicePriceContext(cleanedLabel) || isNonServicePriceLine(evidenceText)) {
    return;
  }
  entries.push({
    value: price,
    evidence: `${cleanedLabel} - ${formatPriceEvidence(price)}`,
    structured: true,
    hasServiceContext: true,
  });
}

function parsePayloadPrice(value, key = "", context = "") {
  const rawValue = String(value || "").replace(/,/g, "");
  const poundMatch = rawValue.match(/£\s*([0-9]{1,4}(?:\.[0-9]{1,2})?)/);
  const numberMatch = rawValue.match(/[0-9]{1,6}(?:\.[0-9]{1,2})?/);
  let price = poundMatch ? Number(poundMatch[1]) : numberMatch ? Number(numberMatch[0]) : Number.NaN;
  if (/cents/i.test(key) && Number.isFinite(price)) {
    price /= 100;
  }
  if (
    Number.isFinite(price) &&
    !/cents/i.test(key) &&
    !poundMatch &&
    Number.isInteger(price) &&
    price >= 1000 &&
    price <= 500000 &&
    /"currency"\s*:\s*"GBP"|"currency_code"\s*:\s*"GBP"|"currencyCode"\s*:\s*"GBP"/i.test(String(context || ""))
  ) {
    price /= 100;
  }
  return Number.isFinite(price) && price >= 10 && price <= 5000 ? price : Number.NaN;
}

async function extractFreshaPriceCheck(html, url = "") {
  if (!isFreshaUrl(url) && !String(html || "").includes("FRESHA_VARS")) {
    return emptyPriceCheck("booking");
  }

  const context = extractFreshaBookingContext(html, url);
  if (!context.locationSlug) {
    return emptyPriceCheck("booking");
  }

  try {
    const response = await fetchWithTimeout("https://www.fresha.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept-language": "en-GB",
        "x-graphql-operation-name": "mutation BookingFlow_Initialize_Mutation",
      },
      body: JSON.stringify({
        operationName: "BookingFlow_Initialize_Mutation",
        variables: {
          input: {
            locationSlug: context.locationSlug,
            referer: "https://www.fresha.com/",
            options: {
              marketingToken: context.searchParams.get("marketingToken"),
              cnToken: context.searchParams.get("cnToken"),
              via: context.searchParams.get("via"),
              isGroupBooking: context.searchParams.get("groupBooking") === "true",
              isRebook: context.searchParams.get("rebook") === "true",
              rwgToken: null,
              geiToken: null,
              employeeId: normalizeNullableFreshaParam(context.searchParams.get("employeeId")),
              professionalProfileSlug: normalizeNullableFreshaParam(context.searchParams.get("professionalSlug")),
              shouldShowAllEmployees: context.searchParams.get("employeeId") === "all",
              isFromLinkBuilder: context.searchParams.has("menu") || context.searchParams.has("share"),
              waitlistEntryToken: context.searchParams.get("waitlistEntryToken"),
              firstTouchAt: null,
              clientChannelType: "DIRECT",
              appointmentId: context.searchParams.get("appointmentId"),
              giftCardCode: context.searchParams.get("claim-gift") || context.searchParams.get("claim_gift"),
              offerItemId: context.searchParams.get("offerItemId"),
              offerItems: context.searchParams.get("offerItems")?.split(",").filter(Boolean) || null,
              cartId: context.searchParams.get("cartId"),
              rewardIds: null,
              providerReferences: null,
              referralCode: null,
              preferredDate: context.searchParams.get("preferredDate"),
              preferredTimeslot: context.searchParams.get("preferredTimeslot"),
              landingPageUrl: null,
              externalReferrerUrl: null,
            },
            shouldAutoContinue: false,
            capabilities: ["SERVICE_ADDONS", "CONFIRMATION", "MARKETPLACE_REFRESH"],
          },
          fullUpfrontPaymentEnabled: false,
          discountsAndBenefitsEnabled: false,
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: "ddd7483bf26f2f06ae68a8ec83140a2501aa313bd1e7f3845b9f2f91ebce85f5",
          },
        },
      }),
    });

    if (!response.ok) {
      return emptyPriceCheck("booking");
    }

    const data = await response.json();
    const entries = extractFreshaPriceEntries(data);
    return entries.length ? buildPriceCheckFromEntries(entries, "booking", { structured: true }) : emptyPriceCheck("booking");
  } catch {
    return emptyPriceCheck("booking");
  }
}

function extractFreshaBookingContext(html, url = "") {
  const parsedUrl = safeUrl(url);
  const context = {
    locationSlug: "",
    searchParams: parsedUrl?.searchParams ? new URLSearchParams(parsedUrl.searchParams) : new URLSearchParams(),
  };

  if (parsedUrl?.pathname) {
    const slugMatch = parsedUrl.pathname.match(/\/a\/([^/]+)\/booking\b/);
    if (slugMatch) {
      context.locationSlug = decodeURIComponent(slugMatch[1]);
    }
  }

  const nextData = extractNextData(html);
  const pageProps = nextData?.props?.pageProps || {};
  if (!context.locationSlug && typeof pageProps.locationSlug === "string") {
    context.locationSlug = pageProps.locationSlug;
  }
  if (pageProps.searchParams && typeof pageProps.searchParams === "object") {
    Object.entries(pageProps.searchParams).forEach(([key, value]) => {
      if (!context.searchParams.has(key) && value != null) {
        context.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
      }
    });
  }

  return context;
}

function extractNextData(html) {
  const match = String(html || "").match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractFreshaPriceEntries(data) {
  const categories = data?.data?.bookingFlowInitialize?.screenServices?.categories;
  if (!Array.isArray(categories)) {
    return [];
  }

  return categories
    .flatMap((category) => {
      const categoryName = cleanPriceEvidenceText(category?.name);
      return Array.isArray(category?.items)
        ? category.items.map((item) => {
            const price = parseAppointmentPrice(item?.price?.formatted);
            if (!Number.isFinite(price)) {
              return null;
            }
            const name = cleanPriceEvidenceText(item?.name || categoryName || "Service");
            const evidenceText = [categoryName, name, item?.caption, item?.description].filter(Boolean).join(" ");
            if (isNonServicePriceLine(evidenceText)) {
              return null;
            }
            return {
              value: price,
              evidence: `${name} - ${cleanPriceEvidenceText(item.price.formatted)}`,
              structured: true,
            };
          })
        : [];
    })
    .filter(Boolean)
    .slice(0, 80);
}

function normalizeNullableFreshaParam(value) {
  return value && value !== "all" ? value : null;
}

function isFreshaUrl(url) {
  return safeHost(url).endsWith("fresha.com");
}

function extractBooksyPriceCheck(html, url = "") {
  const host = safeHost(url);
  if (!host.endsWith("booksy.com")) {
    return emptyPriceCheck("booking");
  }

  const scripts = extractAllJsonLd(html);
  for (const data of scripts) {
    const items = [data, ...(data?.["@graph"] ?? [])];
    for (const item of items) {
      const offers = item?.makesOffer;
      if (!Array.isArray(offers) || offers.length === 0) {
        continue;
      }
      const entries = offers
        .map((offer) => {
          const price = parseAppointmentPrice(offer?.price);
          if (!Number.isFinite(price)) {
            return null;
          }
          const name = cleanPriceEvidenceText(offer?.name || "Service");
          if (isNonServicePriceLine(name)) {
            return null;
          }
          return { value: price, evidence: `${name} - ${formatPriceEvidence(price)}`, structured: true };
        })
        .filter(Boolean)
        .slice(0, 80);
      if (entries.length) {
        return buildPriceCheckFromEntries(entries, "booking", { structured: true });
      }
    }
  }
  return emptyPriceCheck("booking");
}

function extractSetmorePriceCheck(html, url = "") {
  const host = safeHost(url);
  if (!host.endsWith("setmore.com")) {
    return emptyPriceCheck("booking");
  }

  const nextData = extractNextData(html);
  const services = nextData?.props?.pageProps?.company?.services;
  if (!Array.isArray(services) || services.length === 0) {
    return emptyPriceCheck("booking");
  }

  const entries = services
    .map((service) => {
      const price = parseAppointmentPrice(service?.price);
      if (!Number.isFinite(price)) {
        return null;
      }
      const name = cleanPriceEvidenceText(service?.title || service?.name || "Service");
      const evidenceText = [name, service?.description].filter(Boolean).join(" ");
      if (isNonServicePriceLine(evidenceText)) {
        return null;
      }
      return { value: price, evidence: `${name} - ${formatPriceEvidence(price)}`, structured: true };
    })
    .filter(Boolean)
    .slice(0, 80);

  return entries.length ? buildPriceCheckFromEntries(entries, "booking", { structured: true }) : emptyPriceCheck("booking");
}

function extractTreatwellPriceCheck(html, url = "") {
  const host = safeHost(url);
  if (!host.endsWith("treatwell.co.uk") && !host.endsWith("treatwell.com")) {
    return emptyPriceCheck("booking");
  }

  const scripts = extractAllJsonLd(html);
  const entries = [];
  for (const data of scripts) {
    const items = [data, ...(data?.["@graph"] ?? [])];
    for (const item of items) {
      const catalogs = item?.hasOfferCatalog?.itemListElement;
      if (!Array.isArray(catalogs)) {
        continue;
      }
      for (const catalog of catalogs) {
        const offers = catalog?.itemListElement ?? [];
        for (const offer of offers) {
          // AggregateOffer uses lowPrice; plain Offer uses price
          const rawPrice = offer?.lowPrice ?? offer?.price;
          const price = parseAppointmentPrice(rawPrice);
          if (!Number.isFinite(price)) {
            continue;
          }
          const name = cleanPriceEvidenceText(offer?.itemOffered?.name || catalog?.name || "Service");
          if (isNonServicePriceLine(name)) {
            continue;
          }
          entries.push({ value: price, evidence: `${name} - ${formatPriceEvidence(price)}`, structured: true });
        }
      }
    }
  }

  // Also pick up top-level Offer items (not nested in a catalog)
  for (const data of scripts) {
    const items = [data, ...(data?.["@graph"] ?? [])];
    for (const item of items) {
      if (item?.["@type"] === "Offer" || item?.["@type"] === "AggregateOffer") {
        const rawPrice = item?.lowPrice ?? item?.price;
        const price = parseAppointmentPrice(rawPrice);
        if (!Number.isFinite(price)) {
          continue;
        }
        const name = cleanPriceEvidenceText(item?.itemOffered?.name || "Service");
        if (!isNonServicePriceLine(name)) {
          entries.push({ value: price, evidence: `${name} - ${formatPriceEvidence(price)}`, structured: true });
        }
      }
    }
  }

  const unique = entries.slice(0, 80);
  return unique.length ? buildPriceCheckFromEntries(unique, "booking", { structured: true }) : emptyPriceCheck("booking");
}

function extractSquarePriceCheck(html, url = "") {
  const host = safeHost(url);
  if (!/square(?:up)?\.com|square\.site/.test(host)) {
    return emptyPriceCheck("booking");
  }

  const decoded = decodeHtmlEntities(String(html || ""))
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0022/g, "\"")
    .replace(/\\\//g, "/");
  const services = extractJsonArrayAfterKey(decoded, "services");
  const entries = services.map((service) => {
    const name = cleanPriceEvidenceText(service?.name || "");
    const price = parsePayloadPrice(service?.price_cents ?? service?.priceCents, "price_cents");
    const evidenceText = [name, service?.description, service?.description_html].filter(Boolean).join(" ");
    if (!Number.isFinite(price) || isNonServicePriceLine(evidenceText)) {
      return null;
    }
    return {
      value: price,
      evidence: `${name} - ${formatPriceEvidence(price)}`,
      structured: true,
      hasServiceContext: true,
    };
  }).filter(Boolean);

  const unique = [];
  const seen = new Set();
  entries.forEach((entry) => {
    const key = `${entry.value}:${entry.evidence}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  });

  return unique.length ? buildPriceCheckFromEntries(unique.slice(0, 80), "booking", { structured: true }) : emptyPriceCheck("booking");
}

function extractJsonArrayAfterKey(text = "", key = "") {
  const marker = `"${key}"`;
  const markerIndex = String(text || "").indexOf(marker);
  if (markerIndex === -1) {
    return [];
  }
  const arrayStart = text.indexOf("[", markerIndex + marker.length);
  if (arrayStart === -1) {
    return [];
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "[") {
      depth += 1;
    }
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(arrayStart, index + 1));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
    }
  }

  return [];
}

async function extractSalonIqPriceCheck(url = "") {
  const parsedUrl = safeUrl(url);
  if (!parsedUrl || !safeHost(url).endsWith("s-iq.co")) {
    return emptyPriceCheck("booking");
  }

  const salonId = parsedUrl.searchParams.get("salonid");
  if (!salonId) {
    return emptyPriceCheck("booking");
  }

  try {
    const baseUrl = "https://s-iq.co";
    const requestHeaders = {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Referer: `${baseUrl}/BookingPortal/dist/?salonid=${salonId}`,
      "X-Requested-With": "XMLHttpRequest",
    };

    // Step 1: Establish session (sets ASP.NET_SessionId cookie)
    const sessionResponse = await fetchWithTimeout(`${baseUrl}/shoponline/GetParameters`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ salonid: salonId, source: "bp" }),
    });
    if (!sessionResponse.ok) {
      return emptyPriceCheck("booking");
    }
    const sessionCookie = cookieHeaderFromSetCookie(sessionResponse.headers.get("set-cookie") || "");

    // Step 2: Fetch services with session cookie
    const servicesResponse = await fetchWithTimeout(`${baseUrl}/shoponline/getServices`, {
      method: "POST",
      headers: { ...requestHeaders, Cookie: sessionCookie },
      body: JSON.stringify({ salonid: salonId, source: "bp" }),
    });
    if (!servicesResponse.ok) {
      return emptyPriceCheck("booking");
    }

    const data = await servicesResponse.json();
    if (data?.Status !== "Success") {
      return emptyPriceCheck("booking");
    }

    const services = data?.Data?.Services;
    if (!Array.isArray(services) || services.length === 0) {
      return emptyPriceCheck("booking");
    }

    const entries = services
      .map((service) => {
        const price = parseAppointmentPrice(service?.DefaultPrice);
        if (!Number.isFinite(price)) {
          return null;
        }
        const name = cleanPriceEvidenceText(service?.Service || "Service");
        const evidenceText = [name, service?.SubCategory, service?.ServiceInfo].filter(Boolean).join(" ");
        if (isNonServicePriceLine(evidenceText)) {
          return null;
        }
        return { value: price, evidence: `${name} - ${formatPriceEvidence(price)}`, structured: true };
      })
      .filter(Boolean)
      .slice(0, 80);

    return entries.length ? buildPriceCheckFromEntries(entries, "booking", { structured: true }) : emptyPriceCheck("booking");
  } catch {
    return emptyPriceCheck("booking");
  }
}

async function extractPhorestPriceCheck(url = "") {
  const slug = extractPhorestSlug(url);
  if (!slug) {
    return emptyPriceCheck("booking");
  }

  try {
    const bootstrapResponse = await fetchWithTimeout(`https://phorest.me/bootstrap/salons/${slug}`, {
      headers: { Accept: "application/json" },
    });
    if (!bootstrapResponse.ok) {
      return emptyPriceCheck("booking");
    }
    const bootstrapData = await bootstrapResponse.json();
    const domainName = bootstrapData?.data?.attributes?.domain_name;
    if (!domainName) {
      return emptyPriceCheck("booking");
    }

    const servicesResponse = await fetchWithTimeout(`https://${domainName}.phorest.me/api/services`, {
      headers: {
        Accept: "application/vnd.phorest.me+json;version=1",
        Authorization: 'Token token="0a380c7d22d718646e7d316c6a5c5d2e"',
      },
    });
    if (!servicesResponse.ok) {
      return emptyPriceCheck("booking");
    }

    const servicesData = await servicesResponse.json();
    const services = servicesData?.services;
    if (!Array.isArray(services) || services.length === 0) {
      return emptyPriceCheck("booking");
    }

    const entries = services
      .map((service) => {
        const price = parseAppointmentPrice(service?.price);
        if (!Number.isFinite(price)) {
          return null;
        }
        const name = cleanPriceEvidenceText(service?.name || "Service");
        if (isNonServicePriceLine(name)) {
          return null;
        }
        return { value: price, evidence: `${name} - ${formatPriceEvidence(price)}`, structured: true };
      })
      .filter(Boolean)
      .slice(0, 80);

    return entries.length ? buildPriceCheckFromEntries(entries, "booking", { structured: true }) : emptyPriceCheck("booking");
  } catch {
    return emptyPriceCheck("booking");
  }
}

function extractPhorestSlug(url = "") {
  const parsedUrl = safeUrl(url);
  if (!parsedUrl) {
    return null;
  }
  const host = parsedUrl.hostname.toLowerCase();
  // {slug}.phorest.me
  if (host.endsWith(".phorest.me")) {
    return host.replace(/\.phorest\.me$/, "");
  }
  // phorest.com/salon/{slug} or phorest.com/book/salons/{slug}
  if (host === "phorest.com" || host === "www.phorest.com") {
    const match = parsedUrl.pathname.match(/\/(?:salon|book\/salons?)\/([a-z0-9_-]+)/i);
    return match ? match[1].toLowerCase() : null;
  }
  return null;
}

async function extractAcuityEmbedPriceCheck(html = "", url = "") {
  // Already handled when the booking URL is a direct Acuity page
  if (safeHost(url).includes("acuityscheduling.com") || safeHost(url).endsWith(".as.me")) {
    return emptyPriceCheck("booking");
  }

  // Extract owner ID from Squarespace / other embed wrappers
  const ownerIdMatch = String(html || "").match(/data-user-id="(\d+)"/);
  if (!ownerIdMatch) {
    return emptyPriceCheck("booking");
  }
  const ownerId = ownerIdMatch[1];

  try {
    const response = await fetchWithTimeout(`https://app.acuityscheduling.com/schedule.php?owner=${ownerId}`, {
      headers: { Accept: "text/html" },
    });
    if (!response.ok) {
      return emptyPriceCheck("booking");
    }
    const scheduleHtml = await response.text();
    const entries = extractStructuredPriceEntries(scheduleHtml);
    return entries.length ? buildPriceCheckFromEntries(entries, "booking", { structured: true }) : emptyPriceCheck("booking");
  } catch {
    return emptyPriceCheck("booking");
  }
}

function extractEmbeddedBookingPlatformPriceCheck(html, url = "") {
  if (!isKnownStructuredBookingUrl(url) || !html) {
    return emptyPriceCheck("booking");
  }

  const entries = extractEmbeddedJsonObjects(html)
    .flatMap((data) => extractPriceEntriesFromArbitraryData(data))
    .slice(0, 120);
  const uniqueEntries = [];
  const seen = new Set();
  entries.forEach((entry) => {
    const key = `${entry.value}:${entry.evidence}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEntries.push(entry);
    }
  });

  return uniqueEntries.length >= 3 ? buildPriceCheckFromEntries(uniqueEntries.slice(0, 80), "booking", { structured: true }) : emptyPriceCheck("booking");
}

function extractEmbeddedJsonObjects(html = "") {
  const objects = [];
  const nextData = extractNextData(html);
  if (nextData) {
    objects.push(nextData);
  }

  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(String(html || ""))) !== null) {
    const content = match[1]?.trim();
    if (!content || content.length > 2_000_000) {
      continue;
    }
    if (content.startsWith("{") || content.startsWith("[")) {
      try {
        objects.push(JSON.parse(content));
      } catch {
        // skip malformed script JSON
      }
    }
  }

  objects.push(...extractAllJsonLd(html));
  return objects;
}

function extractPriceEntriesFromArbitraryData(data, context = {}, depth = 0) {
  if (!data || depth > 7) {
    return [];
  }
  if (Array.isArray(data)) {
    return data.flatMap((item) => extractPriceEntriesFromArbitraryData(item, context, depth + 1));
  }
  if (typeof data !== "object") {
    return [];
  }

  const localContext = {
    name: cleanPriceEvidenceText(data.name || data.title || data.serviceName || data.service_name || data.displayName || data.display_name || data.itemName || data.item_name || data.label || context.name || ""),
    category: cleanPriceEvidenceText(data.categoryName || data.category_name || data.category || data.groupName || data.group_name || data.serviceCategory || data.service_category || context.category || ""),
    description: cleanPriceEvidenceText(data.description || data.caption || data.summary || data.shortDescription || data.short_description || context.description || ""),
  };
  const rawPrice =
    data.price ??
    data.Price ??
    data.amount ??
    data.Amount ??
    data.value ??
    data.Value ??
    data.cost ??
    data.Cost ??
    data.salePrice ??
    data.sale_price ??
    data.finalPrice ??
    data.final_price ??
    data.lowPrice ??
    data.low_price ??
    data.minPrice ??
    data.min_price ??
    data.fromPrice ??
    data.from_price ??
    data.priceInfo ??
    data.price_info ??
    data.priceText ??
    data.price_text ??
    data.DefaultPrice;
  const price = parseStructuredObjectPrice(rawPrice, data);
  const label = cleanPriceEvidenceText([localContext.category, localContext.name].filter(Boolean).join(" - ") || "Service");
  const evidenceText = [localContext.category, localContext.name, localContext.description].filter(Boolean).join(" ");
  const ownEntries = Number.isFinite(price) && isLikelyServicePriceContext(label) && !isNonServicePriceLine(evidenceText)
    ? [{ value: price, evidence: `${label} - ${formatPriceEvidence(price)}`, structured: true, hasServiceContext: true }]
    : [];

  const childEntries = Object.entries(data)
    .filter(([key]) => !/image|photo|avatar|icon|url|href|slug|id|uuid|token|colour|colorCode/i.test(key))
    .flatMap(([, value]) => extractPriceEntriesFromArbitraryData(value, localContext, depth + 1));
  return [...ownEntries, ...childEntries];
}

function parseStructuredObjectPrice(rawPrice, data = {}) {
  if (typeof rawPrice === "object" && rawPrice !== null) {
    return parseAppointmentPrice(rawPrice.formatted ?? rawPrice.display ?? rawPrice.amount ?? rawPrice.value);
  }

  if (typeof rawPrice === "number") {
    const currency = String(data.currency || data.currency_code || data.currencyCode || "").toUpperCase();
    if (currency === "GBP" && Number.isInteger(rawPrice) && rawPrice >= 1000 && rawPrice <= 500000) {
      const pounds = rawPrice / 100;
      return pounds >= 10 && pounds <= 5000 ? pounds : Number.NaN;
    }
  }

  return parseAppointmentPrice(rawPrice);
}

function extractAllJsonLd(html) {
  if (!html) {
    return [];
  }
  const results = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1]));
    } catch {
      // skip malformed
    }
  }
  return results;
}

function extractStructuredPriceEntries(html) {
  const business = extractAcuityBusiness(html);
  if (!business) {
    return [];
  }

  return extractAcuityAppointments(business)
    .map((appointment) => {
      const price = parseAppointmentPrice(appointment.price);
      if (!Number.isFinite(price)) {
        return null;
      }
      const evidenceText = [appointment.category, appointment.name, appointment.description].filter(Boolean).join(" ");
      if (isNonServicePriceLine(evidenceText)) {
        return null;
      }
      return {
        value: price,
        evidence: `${cleanPriceEvidenceText(appointment.name || appointment.category || "Service")} - ${formatPriceEvidence(price)}`,
        structured: true,
      };
    })
    .filter(Boolean)
    .slice(0, 60);
}

function extractAcuityAppointments(business) {
  const appointmentTypes = business?.appointmentTypes && typeof business.appointmentTypes === "object" ? business.appointmentTypes : {};
  return Object.values(appointmentTypes)
    .flat()
    .filter((appointment) => appointment && typeof appointment === "object")
    .filter((appointment) => appointment.active !== false && appointment.private !== true && (!appointment.type || appointment.type === "service"));
}

function parseAppointmentPrice(value) {
  if (typeof value === "number") {
    return value >= 10 && value <= 5000 ? value : Number.NaN;
  }
  const match = String(value || "").replace(",", "").match(/[0-9]{1,4}(?:\.[0-9]{1,2})?/);
  const price = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(price) && price >= 10 && price <= 5000 ? price : Number.NaN;
}

function formatPriceEvidence(value) {
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}

function cleanPriceEvidenceText(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractPriceEntries(text, { consultationFocused = false } = {}) {
  const lines = String(text || "")
    .split(/\n|•|·|\|/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .flatMap((line) => {
      // Pre-split long condensed lines so they don't get dropped by the length filter
      if (line.length > 180 && /£/.test(line)) {
        return splitCondensedPriceLine(line).map((s) => s.replace(/\s+/g, " ").trim());
      }
      return [line];
    })
    .filter((line) => line.length >= 2 && line.length <= 180)
    .filter((line) => !/cookie|privacy|terms|login|sign in|copyright|javascript/i.test(line));

  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/£|&pound;|gbp|british pounds?/i.test(line)) {
      continue;
    }

    const normalizedLine = line.replace(/&pound;/gi, "£").replace(/\bGBP\b/gi, "£");
    if (consultationFocused && isStandalonePriceLine(normalizedLine)) {
      continue;
    }
    if (isNonServicePriceLine(normalizedLine)) {
      continue;
    }

    const prices = extractPriceValuesFromLine(normalizedLine);

    if (!prices.length) {
      continue;
    }

    // When a line has more than 2 prices it's a condensed multi-service line —
    // split each price into its own entry rather than averaging.
    if (prices.length > 2) {
      const segments = splitCondensedPriceLine(normalizedLine);
      for (const segment of segments) {
        const segPrices = extractPriceValuesFromLine(segment);
        if (!segPrices.length) {
          continue;
        }
        const segValue = segPrices.length === 2 ? Math.round((segPrices[0] + segPrices[1]) / 2) : segPrices[0];
        const segContext = getInlinePriceServiceContext(segment) || getPriceServiceContext(lines, index);
        if (!segContext && isStandalonePriceLine(segment)) {
          continue;
        }
        const segText = segment.length > 120 ? `${segment.slice(0, 117)}...` : segment;
        const segPriceContext = getPriceClassificationContext(lines, index, segment, segContext);
        entries.push({
          value: segValue,
          evidence: segContext ? `${segContext} - ${segText}` : segText,
          hasServiceContext: Boolean(segContext),
          priceContext: segPriceContext,
        });
      }
      continue;
    }

    const value = prices.length === 2 ? Math.round((prices[0] + prices[1]) / 2) : prices[0];
    const context = getInlinePriceServiceContext(normalizedLine) || getPriceServiceContext(lines, index);
    if (!context && isStandalonePriceLine(normalizedLine)) {
      continue;
    }
    const priceText = normalizedLine.length > 120 ? `${normalizedLine.slice(0, 117)}...` : normalizedLine;
    const priceContext = getPriceClassificationContext(lines, index, normalizedLine, context);
    entries.push({
      value,
      evidence: context ? `${context} - ${priceText}` : priceText,
      hasServiceContext: Boolean(context),
      priceContext,
    });
  }

  const unique = new Map();
  entries.forEach((entry) => {
    unique.set(`${entry.value}-${entry.evidence}`, entry);
  });
  return [...unique.values()].slice(0, 60);
}

function getPriceClassificationContext(lines, priceLineIndex, priceLine = "", serviceContext = "") {
  const contextLines = [
    serviceContext,
    priceLine,
  ];

  for (let index = priceLineIndex + 1; index < Math.min(lines.length, priceLineIndex + 6); index += 1) {
    const line = cleanPriceEvidenceText(lines[index]);
    if (!line || /£|&pound;|gbp|british pounds?/i.test(line)) {
      break;
    }
    if (/^(book|select|show all|read more|more info|price|from)$/i.test(line)) {
      break;
    }
    if (isLikelyServicePriceContext(line)) {
      break;
    }
    contextLines.push(line);
  }

  return contextLines
    .map((line) => cleanPriceEvidenceText(line))
    .filter(Boolean)
    .join(" ");
}

function extractPriceValuesFromLine(line = "") {
  const normalizedLine = String(line || "").replace(/&pound;/gi, "£").replace(/\bGBP\b/gi, "£");
  return [
    ...[...normalizedLine.matchAll(/£\s*([0-9]{1,4}(?:[,.][0-9]{1,2})?)/g)].map((match) => match[1]),
    ...[...normalizedLine.matchAll(/\b([0-9]{1,4}(?:[,.][0-9]{1,2})?)\s*(?:british\s+pounds?|pounds?)\b/gi)].map((match) => match[1]),
  ]
    .map((value) => Number(String(value).replace(",", "")))
    .filter((value) => Number.isFinite(value) && value >= 10 && value <= 5000);
}

// Splits a condensed line like "Wash £55 Cut £75 Men's £45" into individual segments per price.
function splitCondensedPriceLine(line = "") {
  const segments = [];
  const regex = /((?:[^£]|£(?!\s*[0-9]))*£\s*[0-9]{1,4}(?:[,.][0-9]{1,2})?(?:\s*[-–]\s*£\s*[0-9]{1,4}(?:[,.][0-9]{1,2})?)?)/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const segment = match[1].trim();
    if (segment) {
      segments.push(segment);
    }
  }
  return segments.length > 1 ? segments : [line];
}

function extractIgnoredManualPriceLines(text = "") {
  return String(text || "")
    .split(/\n|•|·|\|/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => /£|&pound;|gbp|british pounds?|pounds?/i.test(line))
    .filter((line) => isNonServicePriceLine(line) || !extractPriceValuesFromLine(line).length)
    .slice(0, 20);
}

function getPriceServiceContext(lines, priceLineIndex) {
  const candidates = [];
  for (let offset = 1; offset <= 4; offset += 1) {
    candidates.push(lines[priceLineIndex - offset], lines[priceLineIndex + offset]);
  }

  return candidates
    .map((line) => cleanPriceEvidenceText(line))
    .filter(Boolean)
    .filter((line) => !/£|&pound;|gbp|british pounds?/i.test(line))
    .filter((line) => !/^\d+\s*(minutes?|mins?|hours?|hrs?|hr|min)\b/i.test(line))
    .filter((line) => !/^(book|select|show all|read more|more info|price|from)$/i.test(line))
    .find((line) => isLikelyServicePriceContext(line)) || "";
}

function getInlinePriceServiceContext(line) {
  const withoutPrice = cleanPriceEvidenceText(
    String(line || "")
      .replace(/(?:from\s*)?£\s*[0-9]{1,4}(?:[,.][0-9]{1,2})?/gi, " ")
      .replace(/\b[0-9]+\s*(?:minutes?|mins?|hours?|hrs?|hr|min)\b/gi, " ")
      .replace(/\s*@\s*/g, " "),
  );
  return isLikelyServicePriceContext(withoutPrice) ? withoutPrice : "";
}

function isLikelyServicePriceContext(line) {
  const normalized = normalizeServiceText(line);
  return (
    normalized.length >= 4 &&
    normalized.length <= 120 &&
    !isNonServicePriceLine(normalized) &&
    /\b(braid|braids|loc|locs|wig|weave|sew|sewin|sew-in|silk|press|tape|micro|clip|colour|color|cut|trim|wash|blow|treat|treatment|keratin|relax|pony|ponytail|bun|updo|bridal|curl|cornrow|closure|frontal|track|install|installation|maintenance|reinstall|revamp|twist|twists|texture|release|head spa|spa ritual|quick weave|knotless|box braids)\b/.test(normalized)
  );
}

function isConsultationFocusedPricePage(text, url = "") {
  const normalizedUrl = String(url || "").toLowerCase();
  const normalizedText = normalizeServiceText(String(text || "").slice(0, 1200));
  return (
    /consultation|consult\b/.test(normalizedUrl) ||
    /\b(wig|bridal|colour|color|hair|curl|loc|extension|extensions|trichology|scalp)?\s*consultation\b/.test(normalizedText) ||
    /\bconsultation\s*(only|booking|appointment|service)\b/.test(normalizedText)
  );
}

function isStandalonePriceLine(line) {
  return /^£\s*[0-9]{1,4}(?:[,.][0-9]{1,2})?$/.test(String(line || "").trim());
}

function isNonServicePriceLine(line) {
  const normalized = String(line || "").replace(/&pound;/gi, "£").toLowerCase();
  return (
    /vagaro united kingdom pricing|deposit|patch test|cancellation|late fee|no show|booking fee|gift card|voucher|shipping|delivery|add[\s-]?on only|add on only|extra charge|surcharge|additional charge|service charge/.test(normalized) ||
    /(?:|\b\d+\s*mi\b).{0,80}£/.test(normalized) ||
    /\bper\s+(?:bundle|track|row|line|pack|packet|weft)\b/.test(normalized) ||
    /£\s*\d+(?:[,.]\d{1,2})?\s*(?:per|\/)\s*(?:bundle|track|row|line|pack|packet|weft)\b/.test(normalized) ||
    /\b(?:wig|bridal|colour|color|hair|curl|loc|extension|extensions|trichology|scalp)?\s*consultation\b/.test(normalized) ||
    /\bconsultation\s*(?:only|booking|appointment|service)?\b/.test(normalized) ||
    /£\s*\d+(?:[,.]\d{1,2})?\s*(?:off|discount|saving|credit|voucher)/.test(normalized) ||
    /(?:save|get|take)\s+£\s*\d+(?:[,.]\d{1,2})?\s*(?:off|discount)?/.test(normalized) ||
    /(?:off|discount)\s+(?:when|with|on|for)\b/.test(normalized)
  );
}

function priceBandForValue(value) {
  if (!Number.isFinite(value)) {
    return "";
  }
  if (value < 100) {
    return "£";
  }
  if (value <= 200) {
    return "££";
  }
  if (value <= 300) {
    return "£££";
  }
  return "££££";
}

function emptyPriceCheck(source = "") {
  return {
    source,
    confidence: "unknown",
    priceBand: "",
    medianPrice: null,
    prices: [],
    priceCount: 0,
    evidence: [],
    servicePriceBand: "",
    serviceMedianPrice: null,
    servicePrices: [],
    servicePriceCount: 0,
    packagePriceBand: "",
    packageMedianPrice: null,
    packagePrices: [],
    packagePriceCount: 0,
    priceIncludesHair: false,
    priceComparisonMode: "",
  };
}

function extractStructuredBookingData(html) {
  const business = extractAcuityBusiness(html);
  if (!business) {
    return { rawServices: [], areaId: "" };
  }

  const rawServices = [];
  const seenCategories = new Set();
  extractAcuityAppointments(business).forEach((appointment) => {
    const category = cleanPriceEvidenceText(appointment.category);
    if (category && !seenCategories.has(category)) {
      seenCategories.add(category);
      rawServices.push(category);
    }
    rawServices.push(appointment.name);
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
  const markerMatch = String(html || "").match(/\b(?:var\s+)?BUSINESS\s*=\s*\{/);
  if (!markerMatch || markerMatch.index === undefined) {
    return null;
  }

  const objectStart = html.indexOf("{", markerMatch.index);
  if (objectStart === -1) {
    return null;
  }

  const nextVariableIndex = html.indexOf("var FEATURE_FLAGS", objectStart);
  if (nextVariableIndex !== -1) {
    const candidate = html.slice(objectStart, nextVariableIndex).replace(/;\s*$/, "").trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // Fall through to brace-balanced extraction below.
    }
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
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
  const text = htmlToReadableText(html);

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

function htmlToReadableText(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
        "User-Agent": browserUserAgent,
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

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
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

function findDraftDuplicates(candidate, { drafts = [], salons = [] } = {}) {
  const candidateKeys = getDuplicateKeys(candidate);
  if (!candidateKeys.hasAny) {
    return [];
  }

  return [
    ...drafts.map((draft) => ({ item: draft, source: "draft" })),
    ...salons.map((salon) => ({ item: salon, source: "published" })),
  ]
    .map(({ item, source }) => {
      const reasons = getDuplicateReasons(candidateKeys, getDuplicateKeys(item));
      return reasons.length ? { id: item.id || "", name: item.name || "Untitled stylist", source, reasons } : null;
    })
    .filter(Boolean)
    .slice(0, 5);
}

function getDuplicateKeys(item) {
  const name = normalizeDuplicateName(item?.name);
  const links = [
    ["booking link", item?.bookingUrl],
    ["Instagram link", item?.instagramUrl],
    ["website link", item?.websiteUrl],
    ["TikTok link", item?.tiktokUrl],
  ]
    .map(([label, value]) => ({ label, value: normalizeDuplicateUrl(value) }))
    .filter((link) => link.value);

  return {
    name,
    links,
    hasAny: Boolean(name || links.length),
  };
}

function getDuplicateReasons(candidate, existing) {
  const reasons = [];
  if (candidate.name && existing.name && candidate.name === existing.name) {
    reasons.push("same name");
  }

  for (const candidateLink of candidate.links) {
    const existingLink = existing.links.find((link) => link.value === candidateLink.value);
    if (existingLink) {
      reasons.push(candidateLink.label === existingLink.label ? candidateLink.label : `${candidateLink.label} matches ${existingLink.label}`);
    }
  }

  return [...new Set(reasons)];
}

function normalizeDuplicateName(value) {
  const name = slugify(value);
  if (!name || name === "stylist" || name === "new-stylist") {
    return "";
  }
  return name;
}

function normalizeDuplicateUrl(value) {
  const raw = cleanString(value);
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    if (host === "instagram.com") {
      const profile = getInstagramProfilePath(raw);
      return profile ? `instagram.com/${profile}` : "";
    }

    if (host === "tiktok.com" && pathParts[0]?.startsWith("@")) {
      return `tiktok.com/${pathParts[0].toLowerCase()}`;
    }

    const searchParams = new URLSearchParams(parsed.search);
    for (const key of [...searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) {
        searchParams.delete(key);
      }
    }

    const pathname = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    const search = searchParams.toString();
    const hash = parsed.hash.toLowerCase();
    return `${host}${pathname || "/"}${search ? `?${search}` : ""}${hash}`;
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
  }
}

function formatDuplicateMessage(duplicates) {
  const first = duplicates[0];
  const reason = first?.reasons?.length ? ` (${first.reasons.join(", ")})` : "";
  return first ? `Possible duplicate: ${first.name}${reason}. Open the existing ${first.source === "published" ? "published stylist" : "draft"} instead.` : "Possible duplicate found.";
}

function formatBulkDuplicateMessage(duplicateResults) {
  const count = duplicateResults.length;
  const first = duplicateResults[0]?.duplicates?.[0];
  if (!first) {
    return "No new drafts created because every intake item looked like a duplicate.";
  }
  return `No new drafts created. ${count} intake item${count === 1 ? "" : "s"} looked duplicate; first match: ${first.name}.`;
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
  const priceBand = sanitizePriceBand(input.priceBand);
  const servicePriceBand = sanitizePriceBand(input.servicePriceBand);
  const packagePriceBand = sanitizePriceBand(input.packagePriceBand);

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
    priceBand: priceBand || servicePriceBand,
    servicePriceBand,
    packagePriceBand,
    priceIncludesHair: input.priceIncludesHair === true,
    priceComparisonMode: sanitizePriceComparisonMode(input.priceComparisonMode),
    priceSource: priceBand || servicePriceBand || packagePriceBand ? sanitizePriceSource(input.priceSource) || "manual" : "",
    priceEvidence: toArray(input.priceEvidence),
    priceCheckedAt: cleanString(input.priceCheckedAt),
    priceUpdatedAt: cleanString(input.priceUpdatedAt),
    priceConfidence: priceBand || servicePriceBand || packagePriceBand ? sanitizePriceConfidence(input.priceConfidence) || "manual" : "",
    summary: cleanString(input.summary),
    warnings: toArray(input.warnings),
    evidence: toArray(input.evidence),
  };
}

function buildPricingUpdate(update, current = {}, now = new Date().toISOString()) {
  const servicePriceBand = sanitizePriceBand(update.servicePriceBand);
  const packagePriceBand = sanitizePriceBand(update.packagePriceBand);
  const priceBand = sanitizePriceBand(update.priceBand) || servicePriceBand || packagePriceBand;
  if (!priceBand) {
    return {
      priceBand: "",
      servicePriceBand: "",
      packagePriceBand: "",
      priceIncludesHair: false,
      priceComparisonMode: "",
      priceSource: "",
      priceEvidence: [],
      priceCheckedAt: "",
      priceUpdatedAt: "",
      priceConfidence: "",
    };
  }

  const priceSource = sanitizePriceSource(update.priceSource) || "manual";
  const priceConfidence = sanitizePriceConfidence(update.priceConfidence) || (priceSource === "manual" ? "manual" : "medium");
  const priceIncludesHair = update.priceIncludesHair === true || Boolean(packagePriceBand);
  const priceComparisonMode = sanitizePriceComparisonMode(update.priceComparisonMode) || defaultPriceComparisonMode(servicePriceBand, packagePriceBand, priceIncludesHair);
  const changed =
    priceBand !== current.priceBand ||
    servicePriceBand !== sanitizePriceBand(current.servicePriceBand) ||
    packagePriceBand !== sanitizePriceBand(current.packagePriceBand) ||
    priceIncludesHair !== (current.priceIncludesHair === true) ||
    priceComparisonMode !== cleanString(current.priceComparisonMode) ||
    priceSource !== current.priceSource ||
    priceConfidence !== current.priceConfidence ||
    JSON.stringify(toArray(update.priceEvidence)) !== JSON.stringify(toArray(current.priceEvidence));

  return {
    priceBand,
    servicePriceBand,
    packagePriceBand,
    priceIncludesHair,
    priceComparisonMode,
    priceSource,
    priceEvidence: toArray(update.priceEvidence),
    priceCheckedAt: cleanString(update.priceCheckedAt) || current.priceCheckedAt || "",
    priceUpdatedAt: cleanString(update.priceUpdatedAt) || (changed ? now : current.priceUpdatedAt || ""),
    priceConfidence,
  };
}

function sanitizeFreshnessPricingUpdate(input, current = {}) {
  const servicePriceBand = sanitizePriceBand(input.servicePriceBand);
  const packagePriceBand = sanitizePriceBand(input.packagePriceBand);
  const priceBand = sanitizePriceBand(input.priceBand) || servicePriceBand || packagePriceBand;
  if (!priceBand) {
    return {};
  }
  const now = new Date().toISOString();
  const priceIncludesHair = input.priceIncludesHair === true || Boolean(packagePriceBand);
  return {
    priceBand,
    servicePriceBand,
    packagePriceBand,
    priceIncludesHair,
    priceComparisonMode: sanitizePriceComparisonMode(input.priceComparisonMode) || defaultPriceComparisonMode(servicePriceBand, packagePriceBand, priceIncludesHair),
    priceSource: sanitizePriceSource(input.priceSource) || "auto",
    priceEvidence: toArray(input.priceEvidence).length ? toArray(input.priceEvidence) : toArray(current.priceEvidence),
    priceCheckedAt: cleanString(input.priceCheckedAt) || now,
    priceUpdatedAt: now,
    priceConfidence: sanitizePriceConfidence(input.priceConfidence) || "medium",
  };
}

function hasFreshnessPricingUpdate(input) {
  return Boolean(sanitizePriceBand(input.priceBand) || sanitizePriceBand(input.servicePriceBand) || sanitizePriceBand(input.packagePriceBand));
}

function getAutoPricingUpdate(priceCheck) {
  if (!priceCheck?.priceBand || priceCheck.confidence !== "high") {
    return null;
  }
  const now = new Date().toISOString();
  return {
    priceBand: priceCheck.priceBand,
    servicePriceBand: sanitizePriceBand(priceCheck.servicePriceBand),
    packagePriceBand: sanitizePriceBand(priceCheck.packagePriceBand),
    priceIncludesHair: priceCheck.priceIncludesHair === true,
    priceComparisonMode: sanitizePriceComparisonMode(priceCheck.priceComparisonMode),
    priceSource: "auto",
    priceEvidence: toArray(priceCheck.evidence),
    priceCheckedAt: now,
    priceConfidence: "high",
  };
}

function salonHasAutoPricing(salon = {}) {
  return salon.priceSource === "auto" && Boolean(salon.priceBand);
}

function clearSalonPricing(salon = {}) {
  const {
    priceBand,
    servicePriceBand,
    packagePriceBand,
    priceIncludesHair,
    priceComparisonMode,
    priceSource,
    priceEvidence,
    priceCheckedAt,
    priceUpdatedAt,
    priceConfidence,
    ...rest
  } = salon;
  return rest;
}

function pricingFieldsEqual(current = {}, next = {}) {
  return (
    current.priceBand === next.priceBand &&
    sanitizePriceBand(current.servicePriceBand) === sanitizePriceBand(next.servicePriceBand) &&
    sanitizePriceBand(current.packagePriceBand) === sanitizePriceBand(next.packagePriceBand) &&
    (current.priceIncludesHair === true) === (next.priceIncludesHair === true) &&
    cleanString(current.priceComparisonMode) === cleanString(next.priceComparisonMode) &&
    current.priceSource === next.priceSource &&
    current.priceCheckedAt === next.priceCheckedAt &&
    current.priceConfidence === next.priceConfidence &&
    JSON.stringify(toArray(current.priceEvidence)) === JSON.stringify(toArray(next.priceEvidence))
  );
}

function sanitizePriceBand(value) {
  const cleaned = cleanString(value);
  return priceBands.has(cleaned) ? cleaned : "";
}

function sanitizePriceComparisonMode(value) {
  const cleaned = cleanString(value);
  return ["service-only", "mixed", "package-only"].includes(cleaned) ? cleaned : "";
}

function defaultPriceComparisonMode(servicePriceBand, packagePriceBand, priceIncludesHair = false) {
  if (servicePriceBand && packagePriceBand) {
    return "mixed";
  }
  if (packagePriceBand && !servicePriceBand) {
    return "package-only";
  }
  if (servicePriceBand || !priceIncludesHair) {
    return "service-only";
  }
  return "";
}

function sanitizePriceSource(value) {
  const cleaned = cleanString(value);
  return cleaned === "auto" || cleaned === "manual" ? cleaned : "";
}

function sanitizePriceConfidence(value) {
  const cleaned = cleanString(value);
  return priceConfidences.has(cleaned) ? cleaned : "";
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
    priceBand: sanitizePriceBand(salon.priceBand),
    priceSource: sanitizePriceSource(salon.priceSource),
    priceEvidence: toArray(salon.priceEvidence),
    priceCheckedAt: cleanString(salon.priceCheckedAt),
    priceUpdatedAt: cleanString(salon.priceUpdatedAt),
    priceConfidence: sanitizePriceConfidence(salon.priceConfidence),
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
    ...(sanitizePriceBand(draft.priceBand)
      ? {
          priceBand: sanitizePriceBand(draft.priceBand),
          servicePriceBand: sanitizePriceBand(draft.servicePriceBand),
          packagePriceBand: sanitizePriceBand(draft.packagePriceBand),
          priceIncludesHair: draft.priceIncludesHair === true,
          priceComparisonMode: sanitizePriceComparisonMode(draft.priceComparisonMode) || defaultPriceComparisonMode(sanitizePriceBand(draft.servicePriceBand), sanitizePriceBand(draft.packagePriceBand), draft.priceIncludesHair === true),
          priceSource: sanitizePriceSource(draft.priceSource) || "manual",
          priceEvidence: toArray(draft.priceEvidence),
          priceCheckedAt: cleanString(draft.priceCheckedAt),
          priceUpdatedAt: cleanString(draft.priceUpdatedAt) || new Date().toISOString(),
          priceConfidence: sanitizePriceConfidence(draft.priceConfidence) || "manual",
        }
      : {}),
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
          return ["Wig colouring / bundle colouring"];
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
            return ["Wig colouring / bundle colouring"];
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
  if (service !== "Natural hair coaches / educators") {
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
  if (service !== "Tracks (+ silk press) / partial / invisible sew-in") {
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
  return /\b(afro|natural|curly|curl|hair)\b.*\beducation\b|\beducation\b.*\b(afro|natural|curly|curl|hair)\b|\b(hair|curl|styling)\b.*\btutorial\b|\btutorial\b.*\b(hair|curl|styling)\b|\bhair\s+health\b.*\b(assessment|plan|growth|consultation)\b|\bgrowth\s+plan\b|\bconsultation\b.*\bnatural\b|\bnatural\s+hair\b.*\b(class|education|consultation)\b|\bcurl\s+makeover\b.*\b(hands?\s*on|tutorial|styling)\b/.test(text);
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

  if (normalizedCandidate === "japanese straightening" && !/\bjapanese\b/.test(normalizedInput)) {
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
  if (/\bold\s+kent\s+road\b/.test(text)) {
    return "south-east";
  }
  const areaPatterns = [
    ["essex", /\b(essex|southend|westcliff|romford|ilford|dagenham|barking|grays|basildon|chelmsford)\b/],
    ["kent", /\b(kent|chatham|dartford|gravesend|gillingham|maidstone|bromley)\b/],
    ["croydon", /\bcroydon\b/],
    ["south-east", /\b(south\s*east|se\s*london|peckham|lewisham|greenwich|woolwich|deptford|catford)\b/],
    ["south-west", /\b(south\s*west|sw\s*london|brixton|tooting|wandsworth|clapham|putney|mitcham|streatham)\b/],
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
  const normalizedAreaIds = normalizeAreaIds(areaIds);
  const labelAreaIds = normalizedAreaIds.some((areaId) => londonChildAreaIds.has(areaId))
    ? normalizedAreaIds.filter((areaId) => areaId !== londonParentAreaId)
    : normalizedAreaIds;
  return labelAreaIds.map(areaLabelFor).filter(Boolean).join(" / ");
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
