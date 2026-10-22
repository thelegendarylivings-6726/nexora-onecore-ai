---
name: OneCore AI provider setup
description: Provider selection and safe configuration for OneCore's AI command flow.
---

OneCore commands use the Replit AI Integrations OpenAI-compatible endpoint through `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`. Do not switch to a general OpenAI key or another provider as a silent fallback. If either integration variable is missing, preserve the explicit unavailable response and do not store command text.

**Why:** The configured provider setup callback was not available in this workspace; the required values were supplied through the secure environment-variable flow instead.

**How to apply:** Read only the variable values inside the running server when making a provider request. Never print or ask users to paste them into chat.
