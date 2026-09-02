/*
  Checkout page controller.
  ------------------------------------------------------------------
  Reads the booking draft handed off from the date-selection modal
  (js/booking.js), renders the order summary, then handles guest
  details, account creation, and payment on one page.

  Depends on js/shared.js being loaded first.
  ------------------------------------------------------------------
*/

const draft = readBookingDraft();

const emptyState = document.querySelector("#checkout-empty");
const checkoutForm = document.querySelector("#checkout-content");
const summaryEl = document.querySelector("#order-summary");
const confirmationEl = document.querySelector("#checkout-confirmation");

if (!draft) {
  // Guest landed here directly with no room/dates selected yet.
  if (emptyState) emptyState.style.display = "block";
  if (checkoutForm) checkoutForm.style.display = "none";
} else {
  renderSummary(draft);
}

function renderSummary(d) {
  if (!summaryEl) return;
  summaryEl.innerHTML = `
    <h3>${d.roomName}</h3>
    <dl class="summary-list">
      <div><dt>Check-in</dt><dd>${d.checkIn}</dd></div>
      <div><dt>Check-out</dt><dd>${d.checkOut}</dd></div>
      <div><dt>Nights</dt><dd>${d.nights}</dd></div>
      <div><dt>Rate</dt><dd>₹${d.pricePerNight.toLocaleString("en-IN")} / night</dd></div>
    </dl>
    <div class="summary-total">
      <span>Total</span>
      <strong>₹${d.total.toLocaleString("en-IN")}</strong>
    </div>
    <a href="rooms.html" class="edit-selection">Change room or dates</a>
  `;
}

/* ---- Guest details + account (one form on this page) ---- */
const checkoutFormEl = document.querySelector("#checkout-form");
const passwordError = document.querySelector("#password-error");

checkoutFormEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!draft) return;

  const data = new FormData(checkoutFormEl);
  const name = data.get("name")?.trim();
  const phone = data.get("phone")?.trim();
  const email = data.get("email")?.trim();
  const message = data.get("message")?.trim() || "";
  const password = data.get("password");
  const paymentMethod = data.get("payment-method");

  if (!password || password.length < 8) {
    passwordError.classList.add("show");
    passwordError.textContent = "Password must be at least 8 characters.";
    return;
  }
  passwordError.classList.remove("show");

  const submitBtn = checkoutFormEl.querySelector("#confirm-pay-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Processing…";

  try {
    // 1. Create the guest's account — or sign them in if this email
    // already has one (e.g. a returning guest booking again).
    if (auth) {
      try {
        await auth.createUserWithEmailAndPassword(email, password);
      } catch (authErr) {
        if (authErr.code === "auth/email-already-in-use") {
          try {
            await auth.signInWithEmailAndPassword(email, password);
          } catch (signInErr) {
            throw signInErr;
          }
        } else {
          throw authErr;
        }
      }
    }

    // 2. Charge payment.
    // Replace this block with your gateway's checkout call
    // (Razorpay/Stripe/etc). paymentMethod is one of: card, upi, netbanking.
    // On success, continue to the Firestore write below.

    // 3. Store the confirmed booking.
    if (db) {
      await db.collection("bookings").add({
        ...draft,
        name,
        phone,
        email,
        message,
        paymentMethod,
        status: "confirmed",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    sessionStorage.removeItem("bookingDraft");
    showConfirmation(draft, email);
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm & Pay";
    passwordError.textContent = getFriendlyAuthError(err);
    passwordError.classList.add("show");
  }
});

function showConfirmation(d, email) {
  checkoutForm.style.display = "none";
  confirmationEl.style.display = "block";
  confirmationEl.innerHTML = `
    <h2>You're booked</h2>
    <p>A confirmation has been sent to <strong>${email}</strong>.</p>
    <div class="summary-list">
      <div><dt>Room</dt><dd>${d.roomName}</dd></div>
      <div><dt>Check-in</dt><dd>${d.checkIn}</dd></div>
      <div><dt>Check-out</dt><dd>${d.checkOut}</dd></div>
      <div><dt>Total paid</dt><dd>₹${d.total.toLocaleString("en-IN")}</dd></div>
    </div>
    <p style="margin-top:var(--space-md)">Need to change plans? See our <a href="cancellation-policy.html" style="text-decoration:underline">Cancellation &amp; Refund Policy</a>.</p>
    <a href="index.html" class="btn btn-primary" style="margin-top:var(--space-md)">Back to Home</a>
  `;
}

/* ---- Payment method toggle (shows/hides card fields) ---- */
const paymentRadios = document.querySelectorAll('input[name="payment-method"]');
const cardFields = document.querySelector("#card-fields");

paymentRadios.forEach((radio) =>
  radio.addEventListener("change", () => {
    if (cardFields) cardFields.style.display = radio.value === "card" && radio.checked ? "grid" : "none";
  })
);
