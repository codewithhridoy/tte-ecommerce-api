# Money rules

## Representation

- All monetary values are integer **minor units** (cents for USD/EUR,
  fils for AED, paise for INR, etc.).
- Type alias: `Money` from `@shared/types` (currently a number; will narrow
  to a branded type in a follow-up).
- Currency travels alongside the amount as `varchar(3)` (ISO 4217).

## Forbidden

- `parseFloat`, `Number(x)`-on-a-decimal-string for prices.
- Multiplication that could overflow JS safe integer (≈ 9 quadrillion
  minor units; not a near-term concern but flag values > 1e12).
- `*` or `/` involving floats (e.g. `subtotal * 0.1` for 10% — see below).
- Storing money as `numeric` / `decimal` / `real` in Postgres.

## Percentages

```ts
// WRONG — floating-point error
const discount = subtotalMinor * 0.1

// RIGHT — integer arithmetic, truncate to cent
const discount = Math.floor((subtotalMinor * 10) / 100)
```

See `calculateDiscount()` in `@modules/discount/domain/entities/Coupon`.

## Tax / shipping / total

- Tax and shipping are passed in as minor units already. Computing them is
  out-of-scope for the order use case (delegate to a tax service).
- `total = max(0, subtotal − discount + tax + shipping)`.
- Never let total go negative.

## Cross-currency

- A cart has a single currency, fixed by its first item. Adding an item
  whose variant currency differs is a `ConflictError` (see `AddToCart`).
- Order inherits cart currency. No FX conversion in this codebase.

## Payment

- `PaymentGateway.charge` takes `amountMinor` + `currency`. The provider
  adapter is responsible for any provider-specific unit conversion.
