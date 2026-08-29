# Extracting HD frames from Instagram Reels

How portfolio photos were pulled from Instagram Reel/video posts during a
2026-08-27 admin session, and why this replaced the CDN-thumbnail approach
the automated pipeline (`server/image-search.mjs`, `fetchInstagramPostImage`)
still uses.

## The problem with the existing methods

`fetchInstagramPostImage` (and the ad-hoc DOM-scraping used earlier in the
session) pulls whichever image Instagram's CDN happens to expose for a video
post:

- **`video_additional_cover_frame`** — a pre-rendered still Instagram
  generates for the post. Decent resolution (the video's frame size, e.g.
  1080x1920) *when it's available*, but it's an algorithmically-picked
  moment in the clip — sometimes a mid-transition blur, a "before" prep
  shot, or someone mid-blink, not the finished style the caption is about.
  No way to choose a different moment.
- **The designated cover/thumbnail (`og:image` / grid thumbnail)** — the
  frame actually shown in the profile grid and link previews. Correct
  *content* (it's the creator's chosen cover), but Instagram only serves it
  small (commonly 360x640) and, for the `og:image` variant, with a
  play-button icon composited directly into the pixels (`stp=cmp1_...` in
  the URL). Not fixable by editing the URL's query string — the CDN
  signature (`_nc_oc`/`oh`) is tied to the exact `stp` value, so swapping it
  invalidates the request.

Neither gives you "the right moment, at full resolution, with nothing baked
in."

## The fix: scrub the actual video element and capture a frame yourself

Since the post page already has to load and decode the real video to let a
visitor press play, you can drive that same `<video>` element from the
Browser pane, seek it to whatever timestamp shows the finished look, and
rasterize that exact frame to a canvas. This gives native video resolution
(whatever `videoWidth`/`videoHeight` report — 720x1280, 1080x1920, 1080x1440,
1440x2560 were all seen this session depending on the post), no baked-in UI,
and full control over which moment gets used.

### Steps

1. **Navigate to the post** and dismiss the signup/login interstitial
   Instagram shows logged-out visitors (a `computer` click on its close
   button — coordinates vary per screenshot, so screenshot first).

2. **Confirm it's actually a video** before trying to scrub it:

   ```js
   const v = document.querySelector('video');
   JSON.stringify({ hasVideo: !!v, duration: v?.duration, w: v?.videoWidth, h: v?.videoHeight });
   ```

   If `hasVideo` is false the post is a real photo (or photo-carousel slide)
   and none of this is needed — just grab its `<img>` `src` directly.

3. **Play briefly, then seek** to a candidate timestamp. A play-then-pause
   kick is needed first — seeking a `<video>` that has never played can
   silently no-op on some browsers/CDNs:

   ```js
   (async () => {
     const vid = document.querySelector('video');
     vid.muted = true;
     await vid.play().catch(() => {});
     await new Promise(r => setTimeout(r, 300));
     vid.pause();
     vid.currentTime = 19; // pick a timestamp, see below
     await new Promise((resolve) => {
       vid.onseeked = resolve;
       setTimeout(resolve, 2000); // fallback if the event never fires
     });
     return vid.currentTime;
   })();
   ```

4. **Screenshot to preview the frame** before committing to it — cheap, and
   the video player renders the same content the canvas capture will read.
   If it's mid-transition, hands-in-hair, or otherwise unrepresentative,
   just seek again. In practice, near the *end* of a transformation video
   (last 10–20%) usually lands on the reveal; short "GRWM"-style clips often
   have the clean shot in the first few seconds instead. There's no
   universal rule — screenshot and adjust.

5. **Capture the frame to canvas and export as a data URL**:

   ```js
   (() => {
     const vid = document.querySelector('video');
     const canvas = document.createElement('canvas');
     canvas.width = vid.videoWidth;
     canvas.height = vid.videoHeight;
     canvas.getContext('2d').drawImage(vid, 0, 0, canvas.width, canvas.height);
     window.__frameDataUrl = canvas.toDataURL('image/jpeg', 0.9);
     return window.__frameDataUrl.length; // just report the size here
   })();
   ```

   Returning the full string immediately tends to exceed the tool's
   response size limit (roughly >130k characters), which is why the length
   is checked first — see below.

6. **Pull the data out.** A second call that returns `window.__frameDataUrl`
   directly gets truncated with a "result exceeds maximum allowed tokens"
   error, but the *full* value is saved to a JSON file on disk as part of
   that error (`[{type, text}]`). Decode it with a small Python helper
   rather than re-requesting anything from the browser:

   ```python
   import json, re, base64, sys
   in_path, out_path = sys.argv[1], sys.argv[2]
   with open(in_path) as f:
       data = json.load(f)
   text = data[0]['text']
   rest = text[text.index(',') + 1:]
   b64 = re.match(r'[A-Za-z0-9+/=]+', rest).group(0)  # trims stray
       # leading/trailing characters (a quote, appended tab-context text)
       # that a naive fixed-length prefix strip gets wrong
   with open(out_path, 'wb') as out:
       out.write(base64.b64decode(b64))
   ```

   Match the base64 run with a regex rather than assuming a fixed prefix
   length or slicing to a fixed suffix — the tool wraps the string in ways
   (a leading `"`, trailing tab-context text appended to the same field)
   that shift depending on how the result got split, and a fixed offset
   silently corrupts the image instead of failing loudly.

7. **View the decoded file** (the `Read` tool renders images) to do a final
   check before using it — this is also where a low-effort quality pass
   catches storefront-only shots, hands-blocking-the-style frames, or
   before-photos that shouldn't go in a portfolio at all.

## Tagging

These frames get `"source": "instagram-reel-frame"` on the portfolio-photo
entry, not `"instagram-reel-thumbnail"`. The two are meaningfully different
qualities of the same broad "extracted from a Reel, not a real photo post"
category:

- `instagram-reel-thumbnail` — the CDN cover-frame method above, capped at a
  small fixed resolution regardless of the source video.
- `instagram-reel-frame` — a specific frame scrubbed from the video itself,
  at native resolution.

`getPortfolioPhotos` in `src/App.tsx` penalizes `instagram-reel-thumbnail`
specifically (never let a low-quality cover pad a 3-photo card when there
aren't enough real photos to fill it — see the comment there). Because the
check is an exact string match, `instagram-reel-frame` is *not* penalized —
it's treated the same as a real photo, which is the intended effect: it no
longer deserves the lowest-tier treatment.

## Retroactively identifying which existing photos are which

If photo filenames get renamed by some other process after the fact (this
happened mid-session — a concurrent job on the same machine was
re-encoding/re-cropping newly-added files under new UUIDs), don't trust a
recorded filename list. Check actual on-disk resolution instead: the old CDN
method topped out at 640x1136 (usually smaller — 512x640, 480x640, 360x640),
while native-resolution frames always have a smaller side ≥ 720px. A
`sharp(filePath).metadata()` pass with that threshold reliably separates the
two, but only apply it within the specific salons you actually touched —
the same heuristic will also flag unrelated high-res photos added by other
processes, which aren't yours to retag.

## Caveats

- Only applies to video posts/Reels. Real photo carousels don't need any of
  this — their `<img>` elements already serve full-resolution stills
  directly.
- For a multi-slide carousel where slide 1 is a video, this only recovers
  that first slide; later slides need their own pass if they're also video.
- This is a manual, browser-driven technique for one-off admin curation. It
  hasn't been wired into the automated pipeline (`fetchInstagramPostImage`),
  which still returns the lower-quality `video_additional_cover_frame`.
