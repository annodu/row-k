export const verifiedReviewPlatformHostnames: [string, string][] = [
  ["fresha.com", "Fresha"],
  ["treatwell.co.uk", "Treatwell"],
  ["booksy.com", "Booksy"],
  ["vagaro.com", "Vagaro"],
  ["styleseat.com", "StyleSeat"],
  ["setmore.com", "Setmore"],
];

export function getVerifiedReviewsPlatform(bookingUrl: string | undefined): string | null {
  const url = (bookingUrl || "").toLowerCase();
  return verifiedReviewPlatformHostnames.find(([hostname]) => url.includes(hostname))?.[1] ?? null;
}

export function getVerifiedReviewsUrl(bookingUrl: string | undefined): string {
  const url = bookingUrl || "";
  const platform = getVerifiedReviewsPlatform(url);
  if (platform !== "Fresha" && platform !== "Treatwell" && platform !== "Setmore" && platform !== "Vagaro") {
    return url;
  }

  for (const candidate of [url, `https://${url}`]) {
    try {
      const parsed = new URL(candidate);
      if (platform === "Fresha") {
        parsed.searchParams.set("reviews", "true");
      } else if (platform === "Setmore") {
        // Setmore has a dedicated /reviews route off the booking page root.
        parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/reviews`;
      } else if (platform === "Vagaro") {
        // Vagaro's booking URL may point at .../<slug>/services; the reviews
        // section lives at .../<slug>/reviews regardless of the original suffix.
        const [slug] = parsed.pathname.split("/").filter(Boolean);
        if (slug) parsed.pathname = `/${slug}/reviews`;
      } else {
        // widget.treatwell.co.uk is a stripped-down booking embed with no reviews
        // section at all; the same /place/{slug}/ path on the main site has one.
        if (parsed.hostname === "widget.treatwell.co.uk") {
          parsed.hostname = "www.treatwell.co.uk";
        }
        // Treatwell's reviews button just scrolls to this in-page section;
        // there's no query param, so a fragment does the same thing.
        parsed.hash = "reviews";
      }
      return parsed.toString();
    } catch {
      continue;
    }
  }

  return url;
}
