# Choosing the model for a spawned subagent

This rule decides the model and reasoning effort for every subagent this skill spawns: reviewers, the lite reviewer, checks, leaves, and validators. Read it before the first spawn. The orchestrator itself keeps the session model.

**T3 Code.** When T3 orchestration is callable, read `references/t3-dispatch.md` before dispatch. It owns transport, target availability, reasoning effort, collection, and identity receipts. Keep the spawning step's tiers as T3 defaults; the Codex-specific default below applies only outside T3. Explicit instructions and `review_subagents` still select the requested model and effort, but cannot bypass that adapter or weaken a required restriction. A fresh child receives those constraints with its task.

**Default tier.** The step that spawns the subagent names its default tier. In Codex (the host whose subagent tool is `spawn_agent`), the default tier for every subagent is instead `gpt-6.1-terra` with reasoning effort `high`, passed as the spawn's `model` and `reasoning_effort`. That replaces the step's tier, including a step that would otherwise run the subagent on the session model or a cheaper tier.

If the user's or project's active instructions or the live prompt name a model for this subagent, use that model instead of the default tier above. They can name it by the subagent's tier, by its prompt-asset name, or for the subagents being dispatched. Without such an instruction, a model configured for this subagent's role takes precedence over the default tier.

**Configured model.** `review_subagents` in CE config is the model configured for this subagent's role. Read it under this rule:

<!-- ce-config-layers:start -->
**Resolve ordinary CE yaml keys from the two repo files.**

- **Read** `<repo-root>/.compound-engineering/config.local.yaml`, then `config.yaml` (`<repo-root>` = `git rev-parse --show-toplevel`). Missing files are skipped. Gitignore does not change resolution.
- **Win** with the first active (non-commented) value. For scalars, empty is unset; an invalid value continues to the next layer, then the skill default. For lists and maps, a present key — including an empty list or map — replaces the whole key.
- **Do not** use this rule for `docs_root` — that key is `config.yaml` only.
<!-- ce-config-layers:end -->

The key maps a harness name (`codex`, `claude`, `grok`, `cursor`, `opencode`, `antigravity`) to an entry with an optional `model` and an optional `effort`. Only the entry for the current harness applies, and it applies to every subagent this skill spawns. A field the entry leaves out keeps the default tier's value. A field that is not a string is ignored. An explicitly selected effort must be honored. If the native spawn cannot set it, use T3 when its adapter can serve the exact target; otherwise report the reviewer unavailable.

**Refused model.** A selected provider, model, effort, or required restriction remains binding at entry and dispatch. If it is unavailable, report the affected reviewer as unavailable without substituting a target or running it inline. Only outside T3, when no such choice was explicit and the host refuses a skill default, spawn that subagent once more with no model or effort override, so it inherits the session model. Say in Coverage which target was refused and, when the error lists them, which models the host offers. A spawn refused because the host is at its active-agent limit is not this case; the spawning step's own capacity handling covers it.
