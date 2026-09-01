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

## Booking flow

1. Guest clicks "Check Dates" on a room (or "Book Now" in the header) — a
   modal opens showing a **live availability calendar** for that room.
2. Selecting check-in/check-out dates and clicking "Continue to Checkout"
   saves the selection and sends the guest to **`checkout.html`**.
3. `checkout.html` shows the order summary alongside one form: guest
   details, account creation (email + password), and payment method
   (Card / UPI / Net Banking) — then a single "Confirm & Pay" button.
4. On success, the guest sees an on-page confirmation with their
   booking summary and a link to the Cancellation & Refund Policy.

If someone opens `checkout.html` directly without picking a room first,
they see a friendly prompt to go choose one — there's nothing to fall
back on since the room/dates only exist in that browser session
(`sessionStorage`) until checkout completes.

## Availability calendar

Each "Check Dates" / "Check Dates & Book" button opens a calendar for that
room, with already-booked dates greyed out and struck through. Right now
the booked dates are **demo data** — a hardcoded list in `js/shared.js`
(`DEMO_UNAVAILABLE_DATES`), so you can see the feature working before
Firebase is connected.

Once Firestore is set up (see below), replace `getUnavailableDates()` in
`js/shared.js` with a real query — the exact code and comments for this
are already written directly above that function in the file.

## Wiring up the booking system (required for live bookings)

The booking flow (select dates → checkout page with guest details,
account creation, and payment) is built and functional in the front end,
but needs two things connected before it can actually create accounts,
take payments, or show real availability:

### 1. Firebase (accounts + storing bookings)
1. Create a project at https://console.firebase.google.com
2. Enable **Authentication → Sign-in method → Email/Password**
3. Create a **Firestore Database** (start in production mode)
4. In Project Settings → General, copy your web app config
5. Open `js/shared.js` and paste your config into the `firebaseConfig` object
   at the top of the file
6. Add the Firebase SDK script tags to `index.html`, `rooms.html`, and
   `checkout.html` — the exact tags are already written as a comment in the
   `<head>` of each file, just uncomment/paste them in before `js/shared.js`
   loads

### 2. Payment gateway
Open `js/checkout.js`, find the comment block starting `// 2. Charge
payment.` inside the form submit handler, and replace it with your
gateway's checkout call (e.g. Razorpay, Stripe, PayU). On success, the
existing code saves the booking to Firestore and shows the confirmation.

## Cancellation & refund logic

The refund tiers live in one place: `REFUND_POLICY` at the top of
`js/shared.js`, alongside a `calculateRefund()` function. This must match
the table in `cancellation-policy.html` exactly — if you change one, update
the other. A "My Bookings" page isn't built yet; when you add one, call
`calculateRefund(checkInDate, cancelDate, totalAmount)` to show the guest
their refund amount before they confirm a cancellation.

## File structure

```
hotel-site/
├── index.html
├── rooms.html
├── checkout.html
├── cancellation-policy.html
├── css/
│   ├── reset.css
│   ├── variables.css
│   └── main.css
├── js/
│   ├── nav.js
│   ├── scroll-reveal.js
│   ├── shared.js
│   ├── booking.js
│   └── checkout.js
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
