# Codemaps

**Last updated:** 2026-05-07

Per-bounded-context maps of `tte-ecommerce-api`. Each codemap mirrors a
directory under `src/modules/<name>/` and documents the public surface,
domain primitives, persistence, and cross-module wiring of that module.

Architecture and layering rules are normative in `.claude/rules/architecture.md`
and the project root `CLAUDE.md` — codemaps describe **what is**, not what
**should be**.

## Modules

| Module | Codemap | Status |
|--------|---------|--------|
| `auth` | [auth.md](./auth.md) | Current |
| `user` | TODO | Not yet written |
| `product` | TODO | Not yet written |
| `inventory` | TODO | Not yet written |
| `cart` | TODO | Not yet written |
| `order` | TODO | Not yet written |
| `payment` | TODO | Not yet written |
| `discount` | TODO | Not yet written |

## Conventions

- One codemap per bounded context, named after the directory under
  `src/modules/`.
- Each codemap declares `Last updated` and `Source` paths.
- Reference paths, do not paste source. The diff and the file are the truth.
