import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeOutboundHttpUrl } from "./security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function loadGooglePlacesApiKey() {
  if (process.env.GOOGLE_PLACES_API_KEY) return process.env.GOOGLE_PLACES_API_KEY;
  try {
    const raw = await fs.readFile(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    // no .env file; rely on already-exported env vars
  }
  return process.env.GOOGLE_PLACES_API_KEY || "";
}

const addressSourceHostnames = ["fresha.com", "treatwell.co.uk"];

export function isAddressSourcePlatform(bookingUrl) {
  const url = (bookingUrl || "").toLowerCase();
  return addressSourceHostnames.some((hostname) => url.includes(hostname));
}

function extractAddressFromHtml(html) {
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(html))) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
    for (const node of nodes) {
      const address = node?.address;
      if (address && (address.streetAddress || address.postalCode)) {
        return [address.streetAddress, address.addressLocality, address.postalCode].filter(Boolean).join(", ");
      }
    }
  }
  return "";
}

export async function fetchPreciseAddress(bookingUrl) {
  try {
    const safeUrl = await assertSafeOutboundHttpUrl(bookingUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(safeUrl, {
        headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml" },
        signal: controller.signal,
        redirect: "follow",
      });
      if (!response.ok) return "";
      const html = await response.text();
      return extractAddressFromHtml(html);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return "";
  }
}

function normalizeForMatch(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const genericWords = new Set(["hair", "salon", "beauty", "studio", "the", "london", "ltd", "limited", "spa", "and", "of", "co"]);

function compactName(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Compact-string containment (e.g. "HairbyOc" inside "Hairbyoceanne") can look like
// a match even when it's really a truncation that drops the actual distinguishing
// part of the name, or a coincidence (e.g. "OS Hair" landing inside "The-OS-HAIR-
// studio" purely because "Theo's" ends in "os"). A raw length minimum isn't enough
// to catch these — "HairbyOc" is a genuine 8-character prefix, not a fluke — so
// instead we strip a small set of long, low-collision-risk filler words (not short
// ones like "the"/"of", which can eat the start of an unrelated word) and require
// the shorter side to cover most of the longer one, not just be contained in it.
const substringStripWords = ["hair", "salon", "studio", "beauty", "limited", "london", "spa"];

function stripSubstringWords(text) {
  let result = text;
  for (const word of substringStripWords) {
    result = result.split(word).join("");
  }
  return result;
}

function substringOverlapRatio(a, b) {
  const strippedA = stripSubstringWords(compactName(a));
  const strippedB = stripSubstringWords(compactName(b));
  if (strippedA.length < 4 || strippedB.length < 4) return 0;
  if (!(strippedA.includes(strippedB) || strippedB.includes(strippedA))) return 0;
  return Math.min(strippedA.length, strippedB.length) / Math.max(strippedA.length, strippedB.length);
}

export function nameSimilarity(a, b) {
  const substringScore = substringOverlapRatio(a, b);

  const tokensA = new Set(normalizeForMatch(a).filter((w) => !genericWords.has(w)));
  const tokensB = new Set(normalizeForMatch(b).filter((w) => !genericWords.has(w)));
  let tokenScore = 0;
  if (tokensA.size > 0 && tokensB.size > 0) {
    let overlap = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) overlap += 1;
    }
    tokenScore = overlap / Math.max(tokensA.size, tokensB.size);
  }

  return Math.max(substringScore, tokenScore);
}

function postcodeAreaMatches(knownPostcode, formattedAddress) {
  if (!knownPostcode) return null;
  const areaPrefix = knownPostcode.trim().split(/\s+/)[0]?.toLowerCase();
  if (!areaPrefix) return null;
  return (formattedAddress || "").toLowerCase().includes(areaPrefix);
}

const postcodeAreaToRegionWord = {
  sw: "south west",
  se: "south east",
  nw: "north west",
  ec: "central",
  wc: "central",
  n: "north",
  e: "east",
  w: "west",
};

// Ordered so compound phrases ("south east") are matched before their component
// word ("east") would otherwise match first.
const compassPhrases = ["north west", "south west", "north east", "south east", "north", "south", "east", "west", "central"];

function extractPostcodeArea(text) {
  const twoLetter = (text || "").match(/\b([A-Za-z]{2})\d/);
  if (twoLetter && postcodeAreaToRegionWord[twoLetter[1].toLowerCase()]) {
    return twoLetter[1].toLowerCase();
  }
  const oneLetter = (text || "").match(/\b([A-Za-z])\d/);
  if (oneLetter && postcodeAreaToRegionWord[oneLetter[1].toLowerCase()]) {
    return oneLetter[1].toLowerCase();
  }
  return null;
}

export function extractPostcodeToken(address) {
  const match = (address || "").match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i);
  return match ? match[0] : "";
}

// Coarser fallback for salons with no precise postcode/address on file: our own
// region label (e.g. "South East London") is still real signal — cross-check it
// against the postcode area (or county name) in Google's returned address.
// Returns true (corroborated), false (known mismatch), or null (inconclusive).
export function regionCorroborates(salon, formattedAddress) {
  const label = (salon.areaLabel || salon.neighbourhood || "").toLowerCase();
  if (!label) return null;

  const matchedCompassWord = compassPhrases.find((word) => label.includes(word));
  const area = extractPostcodeArea(formattedAddress);

  if (matchedCompassWord && area) {
    const regionWord = postcodeAreaToRegionWord[area];
    if (!regionWord) return null;
    return regionWord === matchedCompassWord;
  }

  // Non-compass labels (Essex, Kent, a specific place name) — plain substring check.
  // Bare "london" alone is too generic to prove anything (nearly every address
  // contains it), so strip it out first; if nothing specific is left, stay inconclusive.
  if (!matchedCompassWord) {
    const specificLabel = label.replace(/\blondon\b/g, "").trim();
    if (!specificLabel) return null;
    return (formattedAddress || "").toLowerCase().includes(specificLabel) ? true : null;
  }

  return null;
}

export async function searchPlace(query, apiKey) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.userRatingCount,places.googleMapsUri",
    },
    body: JSON.stringify({ textQuery: query }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.places?.[0] ?? null;
}

// Runs the same address-hint + text-search + confidence-scoring pipeline the
// batch backfill script uses, but for a single salon — used both by that script
// and by the admin approve-draft flow so a newly published stylist gets matched
// immediately instead of waiting on the next manual backfill run.
export async function matchSalonToGoogle(salon, { apiKey } = {}) {
  const key = apiKey || (await loadGooglePlacesApiKey());
  if (!key) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set in .env or the environment.");
  }

  let addressHint = "";
  if (isAddressSourcePlatform(salon.bookingUrl)) {
    addressHint = await fetchPreciseAddress(salon.bookingUrl);
  }
  const locationHint = addressHint || salon.postcode || salon.neighbourhood || salon.areaLabel || "London";
  // Naming the category steers Google away from same-named businesses in an
  // unrelated category (e.g. a bar or company also called "House of Sisters").
  const query = `${salon.name} hair salon, ${locationHint}`;

  const place = await searchPlace(query, key);

  const noMatch = { googlePlaceId: null, googleReviewCount: 0, googleMapsUri: "", googleMatchConfidence: "no-match", googleCheckedAt: new Date().toISOString() };

  if (!place) {
    return noMatch;
  }

  const nameScore = nameSimilarity(salon.name, place.displayName?.text || "");
  const preciseAddressOk = postcodeAreaMatches(addressHint ? extractPostcodeToken(addressHint) : salon.postcode, place.formattedAddress);
  const preciseAddressKnown = Boolean(addressHint || salon.postcode);
  // Fall back to our own region label (e.g. "South East London") when there's no
  // precise address on file — coarser, but still real corroboration against a
  // name match alone (which is how "Kiommi" matched an unrelated "Kiommi Ltd").
  const regionResult = preciseAddressKnown ? null : regionCorroborates(salon, place.formattedAddress);
  const addressKnown = preciseAddressKnown || regionResult !== null;
  const addressOk = preciseAddressKnown ? preciseAddressOk : regionResult;
  // A region label only narrows things down to a huge area (all of "South East
  // London"), so a single shared common word (e.g. "Esther") isn't enough there —
  // that's how "Hair by Esther" matched an unrelated "Esther Beauty Pro". Require a
  // much stronger name match when address precision is coarse; the finer precise-
  // address path can stay at a lower bar since the address itself is doing more work.
  const nameThreshold = preciseAddressKnown ? 0.4 : 0.7;
  const highConfidence = addressKnown && nameScore >= nameThreshold && addressOk !== false;

  // Anything short of high confidence doesn't get stored at all — every "low
  // confidence" match shipped so far (a single shared word, a coincidental
  // postcode, near-zero name overlap) turned out to be a different business.
  // Rather than keep tuning heuristics to catch each new way that goes wrong,
  // treat "not clearly right" as "no match": nothing about the wrong business
  // (place ID, name, address, review count) is attached to our salon, so there's
  // nothing for the admin tool, the app, or the database to surface by mistake.
  if (!highConfidence) {
    return noMatch;
  }

  return {
    googlePlaceId: place.id,
    googleReviewCount: place.userRatingCount || 0,
    googleMapsUri: place.googleMapsUri || "",
    googleMatchConfidence: "high",
    googleDisplayName: place.displayName?.text || "",
    googleFormattedAddress: place.formattedAddress || "",
    googleCheckedAt: new Date().toISOString(),
    nameScore,
  };
}

// Shared by scripts/backfill-wheelchair-accessibility.mjs and the admin branch
// endpoints — only meaningful once a place has been matched, since it's keyed
// off the place ID rather than any of our own salon fields.
export async function getWheelchairAccessibleEntrance(placeId, apiKey) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "accessibilityOptions",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.accessibilityOptions?.wheelchairAccessibleEntrance === true;
}

// Returns metadata for a place's Google-hosted photos (customer/owner uploads
// via Google Maps/Business Profile) — same shared, high-confidence-only
// pattern as getWheelchairAccessibleEntrance above. Actual image bytes are a
// separate request per photo, see fetchPlacePhotoMedia.
export async function getPlacePhotos(placeId, apiKey) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "photos",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return (data.photos || []).map((photo) => ({
    name: photo.name,
    authorName: photo.authorAttributions?.[0]?.displayName || "",
    authorUrl: photo.authorAttributions?.[0]?.uri || "",
    googleMapsUri: photo.googleMapsUri || "",
  }));
}

// Downloads the actual JPEG bytes for one photo resource name (e.g.
// "places/PLACE_ID/photos/PHOTO_REF"), following Google's redirect to the CDN.
export async function fetchPlacePhotoMedia(photoName, apiKey, { maxWidthPx = 800 } = {}) {
  const response = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`,
    { redirect: "follow" },
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// Same shared/high-confidence-only pattern as getWheelchairAccessibleEntrance
// above. Google's parkingOptions doesn't distinguish dedicated customer
// parking from nearby paid street parking — any true sub-field just means
// "some parking option exists near this place," so we treat it as "parking
// nearby" rather than a guarantee of on-site or free parking.
export async function getParkingAvailable(placeId, apiKey) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "parkingOptions",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  const options = data.parkingOptions || {};
  return Object.values(options).some((value) => value === true);
}
