# Bale Bot API Documentation Snapshot

- Source: https://docs.bale.ai/
- Retrieved: 2026-08-10
- Snapshot: `docs.bale.ai-2026-08-10.html`
- Scope: Complete official Bale Bot API page, including updates, webhooks, bot methods, and wallet payments.

## Payment Notes

- `invoice_payload` correlates Bale updates with an internal payment attempt.
- `PreCheckoutQuery.id` is the unique transaction identifier and must be answered within 10 seconds.
- `SuccessfulPayment` is the documented successful-payment event.
- `telegram_payment_charge_id` is the unique payment ID and equals `PreCheckoutQuery.id` for wallet payments.
- `provider_payment_charge_id` is the Bale wallet tracking number.
- `inquireTransaction` returns `Transaction` with `id`, `status`, `userID`, `amount`, and `createdAt`.
- The printed receipt field labeled `شماره مرجع` is not exposed as a documented Bot API field.
- The documentation does not define webhook HTTP acknowledgement or retry behavior.

When integrating another external API, store a dated source snapshot and a short README like this one under `docs/vendor/<provider>/`.
