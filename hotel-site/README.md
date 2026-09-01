# Marlow House — Deployment Guide

This is a static site — no build step required. Everything works by opening
`index.html`, and it deploys as-is to any static host.

## Before you deploy — replace these placeholders

1. **Hotel name** — currently "Marlow House" across `index.html`, `rooms.html`,
   `cancellation-policy.html`, and the `<title>`/meta tags. Find-and-replace.
2. **Contact info** — phone, email, and address in the footer of each page.
3. **Images** — currently Unsplash placeholder URLs in `index.html` and
   `rooms.html` (search for `images.unsplash.com`). Replace with your own,
   uploaded to an `images/` folder and referenced with relative paths
   (e.g. `images/hero.jpg`).
4. **Room names/prices** — in the room cards on `index.html` and `rooms.html`.

## Deploy — Vercel (recommended, matches the build plan)

**Option A: Drag and drop**
1. Go to https://vercel.com/new
2. Drag this whole folder onto the page
3. Deploy — you'll get a live URL immediately

**Option B: CLI**
```bash
npm install -g vercel
cd hotel-site
vercel
```
Follow the prompts. Running `vercel --prod` publishes to your production URL.

## Deploy — Netlify (alternative)

Drag the folder onto https://app.netlify.com/drop, or connect a Git repo and
set the publish directory to the project root (no build command needed).

## Connecting a custom domain

Both Vercel and Netlify let you add a custom domain from their dashboard
under Project/Site Settings → Domains — just point your domain's DNS at the
records they give you.

## Wiring up the booking system (required for live bookings)

The booking modal (guest details → account creation → payment) is built and
functional in the front end, but needs two things connected before it can
actually create accounts or take payments:

### 1. Firebase (accounts + storing bookings)
1. Create a project at https://console.firebase.google.com
2. Enable **Authentication → Sign-in method → Email/Password**
3. Create a **Firestore Database** (start in production mode)
4. In Project Settings → General, copy your web app config
5. Open `js/booking.js` and paste your config into the `firebaseConfig` object
   at the top of the file
6. Add the Firebase SDK script tags to `index.html` and `rooms.html` — the
   exact tags are already written as a comment in the `<head>` of each file,
   just uncomment/paste them in before `js/booking.js` loads

### 2. Payment gateway
Open `js/booking.js`, find the `payButton` click handler (search for
`confirm-payment`), and replace the stub with your gateway's checkout call
(e.g. Razorpay, Stripe, PayU). On success, the existing code saves the
booking to Firestore.

## Cancellation & refund logic

The refund tiers live in one place: `REFUND_POLICY` at the top of
`js/booking.js`, alongside a `calculateRefund()` function. This must match
the table in `cancellation-policy.html` exactly — if you change one, update
the other. A "My Bookings" page isn't built yet; when you add one, call
`calculateRefund(checkInDate, cancelDate, totalAmount)` to show the guest
their refund amount before they confirm a cancellation.

## File structure

```
hotel-site/
├── index.html
├── rooms.html
├── cancellation-policy.html
├── css/
│   ├── reset.css
│   ├── variables.css
│   └── main.css
├── js/
│   ├── nav.js
│   ├── scroll-reveal.js
│   └── booking.js
└── README.md
```

## Push to GitHub

This folder is already a git repo with an initial commit on `main`. To push it:

```bash
git remote add origin https://github.com/YOUR-USERNAME/marlow-house.git
git push -u origin main
```

Then import the repo at https://vercel.com/new (or Netlify) — pick "Import Git Repository"
instead of drag-and-drop, and every future `git push` will auto-deploy.
