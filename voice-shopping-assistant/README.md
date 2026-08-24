# VoiceCart

A voice-controlled shopping list that runs entirely in the browser. No backend, no build step — just open `index.html` and start talking (or typing) to it.

I built this to see how far I could get with the Web Speech API and some plain regex instead of reaching for an actual NLP library or a paid API. Turns out you can get pretty far.

## What it does

- Add/remove/check off items by voice or text — "add 2 litres of milk", "remove apples", "check off butter"
- Understands quantities and units ("buy 5 oranges", "500g of butter")
- Auto-sorts items into categories (produce, dairy, meat, etc.) based on keywords
- Gives suggestions based on what you've bought before, what's in season, and swaps for things already on your list
- Works offline once loaded (it's a PWA — installable, has a service worker)
- Voice search for the built-in item catalog
- Share your list via the Web Share API or copy-paste

Currently set up for English and Hindi (India) — swapping in more languages is just a matter of adding entries to the `LANGUAGES` array in `app.js`, Web Speech API supports a bunch more.

## How the NLP works

There's no external API call for parsing commands — it's a regex/keyword pipeline instead:

1. Match the transcript against a list of intent patterns (add / remove / check / search / clear) — first match wins
2. Pull out a quantity + unit if there is one ("2 litres", "a dozen", "500g")
3. Strip out the intent words, quantity, and filler phrases ("please", "my list", etc.) — whatever's left is the item name

It's not perfect, but it handles the common phrasings well enough and there's zero latency since nothing leaves the browser.

## Running it

Easiest way is just to serve the folder locally, since Chrome won't allow mic access on a plain `file://` page:

```bash
git clone <this repo>
cd voice-shopping-assistant
python -m http.server 8080
# or: npx serve .
```

Then open `http://localhost:8080`. You can technically open `index.html` directly too, but you'll need to enable "Insecure origins treated as secure" for localhost/file in chrome://flags if you want the mic to work that way — serving it is just easier.

Alt+Space toggles the mic from the keyboard if you don't want to click.

## Browser support

Voice input needs the Web Speech API, so:

- Chrome / Edge — full support
- Safari 16.4+ — mostly works
- Firefox — doesn't implement it, but the text input still works fine as a fallback

Voice recognition also needs HTTPS once you're not on localhost — Chrome blocks the mic on plain HTTP otherwise.

## Files

- `index.html` — the page structure
- `styles.css` — all the styling
- `app.js` — everything else (NLP parsing, the state store, suggestions, voice handling, rendering)
- `sw.js` / `manifest.json` — PWA bits (offline caching, installability)

## Deploying

Any static host works since there's no server component. Netlify Drop, Vercel, or GitHub Pages are the easiest — drag the folder in, or `npx vercel --prod`, or push to a repo and turn on Pages.

## Ideas for later

- Real product data instead of the hardcoded catalog (Open Food Facts API is free and would work well here)
- Barcode scanning via the camera
- Actual cloud sync instead of just localStorage
- Multiple lists (right now there's just the one)
- Light theme option

## License

MIT
