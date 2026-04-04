Manual salons live in [manual-salons.json](/Users/kibitiyudaromosu/Documents/row-k/data/manual-salons.json).

Exa-generated salons live in [exa-salons.json](/Users/kibitiyudaromosu/Documents/row-k/data/exa-salons.json).

How the merge works:
- the app searches both files together
- manual records win if the same booking URL appears in both
- `npm run sync:exa` only updates `exa-salons.json`

Recommended salon shape:

```json
{
  "id": "unique-slug",
  "name": "Salon Name",
  "areaId": "south-east",
  "areaLabel": "South East",
  "neighbourhood": "Peckham",
  "postcode": "SE15",
  "bookingPlatform": "Setmore",
  "bookingUrl": "https://example.setmore.com",
  "websiteUrl": "https://example.com",
  "instagramUrl": "https://www.instagram.com/example/",
  "services": ["Silk press", "Natural hair care"],
  "summary": "Why this salon belongs in ROW K.",
  "source": "manual",
  "evidence": ["Optional note or source URL"]
}
```
