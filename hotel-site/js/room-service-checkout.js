/*
  Room Service checkout controller.
  ------------------------------------------------------------------
  Reads the cart handed off from room-service.html (sessionStorage),
  renders the order summary, then handles delivery details, account
  sign-in/creation, and payment on one page — same pattern as
  js/checkout.js for room bookings.

  Depends on js/shared.js being loaded first (auth, db,
  getFriendlyAuthError).
  ------------------------------------------------------------------
*/

function readRoomServiceDraft() {
  const raw = sessionStorage.getItem("roomServiceDraft");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const draft = readRoomServiceDraft();

const emptyState = document.querySelector("#checkout-empty");
const checkoutContent = document.querySelector("#checkout-content");
const summaryEl = document.querySelector("#order-summary");
const confirmationEl = document.querySelector("#checkout-confirmation");

if (!draft || !draft.items || draft.items.length === 0) {
  if (emptyState) emptyState.style.display = "block";
  if (checkoutContent) checkoutContent.style.display = "none";
} else {
  renderSummary(draft);
}

function renderSummary(d) {
  if (!summaryEl) return;
  summaryEl.innerHTML = `
    <h3>Your Order</h3>
    <div class="summary-list">
      ${d.items
        .map(
          (item) => `
        <div><dt>${item.name} × ${item.qty}</dt><dd>₹${(item.price * item.qty).toLocaleString("en-IN")}</dd></div>
      `
        )
        .join("")}
    </div>
    <div class="summary-total">
      <span>Total</span>
      <strong>₹${d.total.toLocaleString("en-IN")}</strong>
    </div>
    <a href="room-service.html" class="edit-selection">Edit order</a>
  `;
}

/* ---- Payment method toggle ---- */
const paymentRadios = document.querySelectorAll('input[name="payment-method"]');
const cardFields = document.querySelector("#card-fields");

paymentRadios.forEach((radio) =>
  radio.addEventListener("change", () => {
    if (cardFields) cardFields.style.display = radio.value === "card" && radio.checked ? "grid" : "none";
  })
);

/* ---- Submit order ---- */
const form = document.querySelector("#room-service-form");
const orderError = document.querySelector("#order-error");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!draft) return;

  const data = new FormData(form);
  const roomNumber = data.get("room-number")?.trim();
  const phone = data.get("phone")?.trim();
  const message = data.get("message")?.trim() || "";
  const email = data.get("email")?.trim();
  const password = data.get("password");
  const paymentMethod = data.get("payment-method");
  const accountError = document.querySelector("#account-error");

  if (!roomNumber || !phone) {
    orderError.textContent = "Room number and phone number are required.";
    orderError.classList.add("show");
    return;
  }
  orderError.classList.remove("show");

  if (!password || password.length < 8) {
    accountError.textContent = "Password must be at least 8 characters.";
    accountError.classList.add("show");
    return;
  }
  accountError.classList.remove("show");

  const submitBtn = document.querySelector("#confirm-order-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Processing…";

  try {
    // 1. Sign in, or create an account if this email is new.
    if (auth) {
      try {
        await auth.createUserWithEmailAndPassword(email, password);
      } catch (authErr) {
        if (authErr.code === "auth/email-already-in-use") {
          await auth.signInWithEmailAndPassword(email, password);
        } else {
          throw authErr;
        }
      }
    }

    // 2. Charge payment.
    // Replace this block with your payment gateway's checkout call
    // (Razorpay/Stripe/etc) for "card" and "upi". "room-charge" needs
    // no payment call — it just gets added to the guest's folio.

    // 3. Store the order.
    if (db) {
      await db.collection("roomServiceOrders").add({
        items: draft.items,
        total: draft.total,
        roomNumber,
        phone,
        message,
        email,
        paymentMethod,
        status: "received",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    sessionStorage.removeItem("roomServiceDraft");
    showConfirmation(draft, roomNumber);
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm & Pay";
    accountError.textContent = getFriendlyAuthError(err);
    accountError.classList.add("show");
  }
});

function showConfirmation(d, roomNumber) {
  checkoutContent.style.display = "none";
  confirmationEl.style.display = "block";
  confirmationEl.innerHTML = `
    <h2>Order confirmed</h2>
    <p>Your order is on its way to <strong>Room ${roomNumber}</strong>.</p>
    <div class="summary-list">
      ${d.items.map((item) => `<div><dt>${item.name} × ${item.qty}</dt><dd>₹${(item.price * item.qty).toLocaleString("en-IN")}</dd></div>`).join("")}
    </div>
    <div class="summary-total">
      <span>Total</span>
      <strong>₹${d.total.toLocaleString("en-IN")}</strong>
    </div>
    <a href="index.html" class="btn btn-primary" style="margin-top:var(--space-md)">Back to Home</a>
  `;
}
