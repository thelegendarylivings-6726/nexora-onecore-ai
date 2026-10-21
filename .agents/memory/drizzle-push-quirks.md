---
name: Drizzle push failures
description: A workspace-specific schema push behavior worth knowing before retrying migrations.
---

On this workspace, a Drizzle push that fails during relationship or column conflict handling can still have created empty tables. Non-TTY `--force` may still prompt on conflicts.

**Why:** during initial setup, repeated pushes found partially created but empty tables; treating a failure as a full rollback caused schema drift.

**How to apply:** inspect the live schema and relevant row counts before the next push, then align the declared schema without force-dropping data.
