# ADR: Ask router model

**Date:** 7 Sep 2026  
**Status:** Accepted for Phase 14 Part A  
**Owner:** Lalit (read this; the model is not swapped silently)

## Decision

`askRisingAmp` calls **`gpt-4o-mini`**.

## Why this one

Routing a question onto one of ten named queries is a classification job, not arithmetic. The five existing OpenAI callables (`readReceiptImage`, `checkEstimateImport`, `readQuoteFile`, and the same secret and region) already use `gpt-4o-mini`. Staying on that model keeps cost and latency low, keeps one secret (`OPENAI_API_KEY`), and avoids a surprise bill or a slower phone round-trip for a task the small model can do.

The model **never calculates**. It returns a validated route (`query` + `params`, or `none`). Figures come later from `src/queries/` on the client. A bigger model would not make those figures more honest.

## Not chosen

- **gpt-4o / larger chat models** — waste for a ten-way route. Higher cost and latency, same rule (no arithmetic).
- **A model in the browser** — the API key must stay in the Cloud Function. Never a model call from the phone.
- **No model** — Phase 13’s palette already answers a few phrasings with no AI. Ask exists for the phrasings that matcher cannot cover. The router is the only new model call.

## How to change it

Do not edit the model name in `functions/lib/askRisingAmp.js` without a new ADR and an explicit yes. Production does not have this function yet.
