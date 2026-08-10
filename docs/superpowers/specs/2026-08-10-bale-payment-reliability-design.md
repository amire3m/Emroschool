# Bale Payment Reliability Design

## Goal

Make Bale wallet payments complete reliably, give users a server-controlled 15-minute payment window, return expired users to payment-method selection, and expose transaction identifiers per customer in the admin payment view.

## Confirmed Incident

Order `PAY-1786280146021-B6F838` for Seyed Ali Jalali received a Bale successful-payment webhook but remained pending because synchronous `inquireTransaction` failed once and the handler discarded the identifiers while returning success. A later read-only inquiry confirmed tracking number `5704241090258666016` as `paid` for 4,000,000 IRR. The printed receipt reference is `8260047130`.

## Payment Attempt Model

Each payment-method selection creates a distinct `PaymentAttempt`. Bale attempts own their payload, 15-minute deadline, pre-checkout/payment identifiers, tracking number, verification state, and paid time. `PaymentOrder` remains the customer/course aggregate and keeps summary fields for admin lists and exports.

## Bale Flow

1. Creating or restarting a Bale attempt sets a unique payload and `expiresAt` 15 minutes in the future.
2. `/start` and pre-checkout resolve the attempt by payload, not only the order's current payload.
3. Pre-checkout validates active status, deadline, currency, payload, and amount, then stores its unique ID and approval time.
4. Successful payment validates currency, payload, and amount, stores both Bale identifiers, and finalizes atomically without requiring synchronous inquiry.
5. Finalization marks the attempt and order paid, approves the application, upserts enrollment, and invalidates another active attempt.
6. Duplicate webhook delivery is idempotent. A different paid attempt on an already-paid order is recorded as `paid_duplicate` for admin review.

## Expiration And Checkout UX

The server supplies `expiresAt`; the browser only renders the countdown. While a Bale attempt is pending, checkout polls payment status. At zero it asks the server to expire the attempt. If still unpaid, the page returns to payment-method selection and allows either method, including a fresh Bale attempt. If payment completed near the boundary, the final status wins and the user sees success.

An old successful-payment webhook is resolved through attempt history. If the order is still unpaid, a genuine old attempt can complete it so received money is never lost.

## Admin And Recovery

The payment detail view displays the customer, course, order, attempt history, unique Bale payment ID, Bale tracking number, optional manually entered receipt reference, deadline, paid time, and verification state. Pending Bale attempts expose an admin reconciliation action that validates a transaction's paid status and amount before using the same atomic finalization path.

The Ali Jalali order will be reconciled after deployment using the already verified tracking number and supplied receipt reference.

## External Documentation Retention

Every external API provided by the owner must receive a dated complete snapshot under `docs/vendor/<provider>/`, plus a README containing source URL, retrieval date, important semantics, and local integration notes.

## Testing

Pure domain tests cover validation and deadlines. Integration-oriented tests cover idempotent finalization, expiration, late success, duplicate payment detection, and reconciliation amount/status checks. Production verification covers build, database migration, PM2 health, checkout APIs, admin fields, and the recovered historical order.
