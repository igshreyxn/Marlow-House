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

## Firebase status

**This is already wired up** — `js/shared.js` has the real `firebaseConfig`
for the `marlow-house` Firebase project, and every page that needs it
(`index.html`, `rooms.html`, `checkout.html`, `my-bookings.html`,
`room-service-checkout.html`, `admin.html`) already loads the Firebase SDK
before `js/shared.js`.

What's left to finish on the Firebase Console side (see the step-by-step
walkthrough you were sent for this):
1. **Authentication → Sign-in method → Email/Password** — enable it, if
   not done already
2. **Firestore Database → Create Database** — create it in production
   mode, if not done already
3. **Firestore → Rules tab** — paste in the contents of `firestore.rules`
   (in this repo) and Publish. Without this step, Firestore's default
   production rules block all reads/writes, so nothing will save yet.
4. Set the `admin: true` custom claim on your admin account — instructions
   are at the bottom of `firestore.rules`. Until this is done, admin
   dashboard actions (updating an order's status, editing a room, blocking
   a date) will be blocked by the rules in step 3, even though you can
   sign in.

## Payment gateway (still a stub)

Open `js/checkout.js`, find the comment block starting `// 2. Charge
payment.` inside the form submit handler, and replace it with your
gateway's checkout call (e.g. Razorpay, Stripe, PayU). On success, the
existing code saves the booking to Firestore and shows the confirmation.
Do the same in `js/room-service-checkout.js` for room service payments.

## Admin dashboard

`admin.html` is a staff-only page with four panels:

- **Bookings** — every room booking, with guest contact info and any
  special requests message
- **Room Service** — every food order, with room number, phone, delivery
  notes, and a status dropdown (Received / Preparing / Delivered)
- **Availability** — a per-room calendar where you can click a date to
  block or unblock it (separate from dates already taken by guest
  bookings, which show as booked and can't be toggled here)
- **Rooms** — turn a room on/off for bookings and edit its nightly rate

**⚠️ Security — read before going live:** the login on `admin.html`
checks the signed-in email against an `ADMIN_EMAILS` list in
`js/admin.js`. That check runs in the browser, which means it stops a
casual visitor from seeing the dashboard, but it does **not** stop
someone from editing that JS file locally to bypass it, or from writing
directly to your Firestore collections with the browser dev tools. Real
protection has to happen server-side — see `firestore.rules` in this
repo for the actual rules to paste into your Firebase project, plus
step-by-step instructions at the bottom of that file for setting the
`admin: true` custom claim each admin account needs.

**Don't forget:** `ADMIN_EMAILS` in `js/admin.js` is already set to
`sengupta.shreyan9@gmail.com`. Add more emails to that array if you want
additional admin accounts later.

Like the other pages, `admin.html` runs in **demo mode** until Firebase
is configured — any email/password signs in, and all data is sample data
kept only in that browser tab, so you can test every panel immediately.

**Note on Rooms tab scope:** turning a room off or changing its price
here updates Firestore, but `index.html` and `rooms.html` currently show
rooms as static HTML — they don't yet read from Firestore to reflect
those changes live. Wiring that up (having the public pages fetch from
the `rooms` collection instead of hardcoding room cards) is a natural
next step once you're ready for it.

## Cancellation & refund logic

The refund tiers live in one place: `REFUND_POLICY` in `js/shared.js`,
alongside a `calculateRefund()` function. This must match the table in
`cancellation-policy.html` exactly — if you change one, update the other.

## My Bookings page

`my-bookings.html` lets guests either **sign in** or **create a new
account** (toggle at the top of the panel) — account creation isn't only
available through checkout anymore. A new account gets a `guests/{uid}`
Firestore document with their name and email, and starts with an empty
bookings list.

Once signed in, a guest can view their bookings and cancel one, showing
the exact refund amount (via `calculateRefund()`) before they confirm.

**Important:** until Firebase is actually configured in `js/shared.js`,
this page runs in **demo mode** — it skips real sign-in and shows two
sample bookings, so you can see and test the cancel/refund flow
immediately. A banner on the page makes this clear. Once you add your
Firebase config, demo mode turns off automatically: sign-in uses real
Firebase Auth, bookings load from Firestore filtered by the signed-in
guest's email, and cancelling updates the booking's status in Firestore.
No code changes are needed in `js/my-bookings.js` for that switch —
just fill in `firebaseConfig` in `js/shared.js`.

## Room service ordering

`room-service.html` shows the menu (grouped by Starters / Mains / Desserts /
Drinks) with an "Add" button per dish and a running cart in a sidebar,
where quantities can be adjusted with +/− steppers.

"Proceed to Checkout" hands the cart off to **`room-service-checkout.html`**
— same pattern as the room booking checkout, but asking for **room number,
phone number, and an optional delivery note** instead of guest details and
account creation (an order doesn't need its own account). Payment method
selection (Card / UPI / Charge to Room) works the same way as the booking
checkout, and confirming saves the order and shows an on-page confirmation.

Menu items and prices live in `MENU_ITEMS` at the top of `js/room-service.js`
— edit that array to change what's offered.

## File structure

```
hotel-site/
├── index.html
├── rooms.html
├── checkout.html
├── room-service.html
├── room-service-checkout.html
├── my-bookings.html
├── admin.html
├── cancellation-policy.html
├── firestore.rules
├── css/
│   ├── reset.css
│   ├── variables.css
│   └── main.css
├── js/
│   ├── nav.js
│   ├── scroll-reveal.js
│   ├── shared.js
│   ├── booking.js
│   ├── checkout.js
│   ├── my-bookings.js
│   ├── room-service.js
│   ├── room-service-checkout.js
│   └── admin.js
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
