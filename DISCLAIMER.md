# Disclaimer

**AI Context Manager** is a portfolio / demonstration project. It is provided for educational and demonstration purposes only.

## No warranty and limitation of liability

This software is provided **"as is"** and **"as available"**, without warranty of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, accuracy, or non-infringement.

To the **maximum extent permitted by applicable law**, the authors and copyright holders are not liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from use of this software, including loss of data, loss of profits, service interruption, or costs from third-party API use — even if advised of the possibility of such damages.

Some jurisdictions do not allow certain exclusions or limitations; in those cases, our liability is limited to the greatest extent permitted by law.

Program code is also subject to the warranty disclaimer and limitation of liability in **AGPL-3.0** (see [LICENSE](LICENSE), sections 15–17).

## Not a commercial product

This project is **not** a finished commercial SaaS, hosted product, or production AI service. Features, models, prompts, and APIs may change without notice. Do not use it for critical, legal, medical, financial, or safety-related decisions.

It is intended as a **local single-operator** demonstration for portfolio and learning use. It is not advertised or offered as a public multi-user service.

## AI, dual-chat, and tool use

AI Context Manager uses third-party large language models (LLMs) for chat, audit/verify flows, summaries, and tool-assisted artifact drafting. By running it, you acknowledge:

- **No guarantee of correctness.** Model outputs — including chat replies, audits, drafts, diffs, summaries, and tool arguments — may be wrong, incomplete, inconsistent, or inappropriate. They are **not** professional advice.
- **Non-deterministic behaviour.** Results vary by model, prompt, temperature, provider, and randomness.
- **Tool use / function calling.** The model may invoke tools that create or edit drafts and related project data in your local database. You are responsible for reviewing changes before relying on them.
- **Context and RAG.** Session context, user facts, status fields, and ChromaDB retrieval can be incomplete, outdated, or misleading. Do not treat retrieved snippets as ground truth.
- **Third-party processing.** Prompts, chat content, and related metadata may be sent to external providers (e.g. Google Gemini, Anthropic Claude, and optionally Mistral for moderation) under **their** terms and privacy policies. We do not control model behaviour, availability, pricing, or data handling by those providers.
- **Not for unsupervised public deployment.** Running a modified or public-facing multi-user instance is at your own risk; you must comply with AGPL-3.0 source-offer obligations and applicable law.

## Creative assets and documentation

Portfolio overview PDFs, screenshots, and marked creative documentation under `docs/` are licensed separately under **CC BY-NC-ND 4.0** (see [LICENSE-ASSETS.md](LICENSE-ASSETS.md)). You may not use these assets commercially or create derivative works without permission.

## Source code license

Program code is licensed under **AGPL-3.0** (see [LICENSE](LICENSE)). If you modify and run a networked version, you must offer corresponding source to users as required by the license.

## Local data and privacy (single-operator trust model)

This installation is designed as a **single-operator** tool: there is **no user authentication** and **no multi-tenant isolation**. Anyone who can reach the API on your machine can read and write the local databases.

The app stores projects, sessions, chats, drafts, library items, and settings in local **SQLite**. Semantic search uses local **ChromaDB**. No account system or cloud sync is provided. You are responsible for securing your environment, network exposure, backups, and `.env` files.

## Third-party services and LLM costs

LLM API usage may incur costs according to each provider’s pricing, including unexpected usage if keys are exposed or long sessions are left unattended. Never commit API keys; keep `.env` local and private. Provider terms of service apply to your use of their APIs.

## Moderation and accept gates

An interactive **disclaimer / API terms acceptance** gate is enforced in the UI on every startup and on the server before LLM-costing routes. Accept via the modal, or set `DISCLAIMER_ACCEPTED=1` in `backend/.env` for CI/automation (creates no substitute for reading [DISCLAIMER.md](DISCLAIMER.md)).

Optional Mistral moderation (when `MISTRAL_API_KEY` is set) is **best-effort only**: it does not validate output quality, prevent all harmful content, or replace human supervision.
