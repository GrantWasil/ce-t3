# Next steps at a task boundary

**Done:** a user-facing task report names the result or blocker, recommends the next action and its purpose, and includes a ready-to-paste continuation prompt whenever work remains. Name the fitting CE skill and say whether to continue here or in a new thread. Continue authorized work before handing it back; a recommendation does not replace an action this run already owes.

This contract governs free-form task reports. When the active invocation requires a caller-owned return or an explicit output-only format, preserve that payload without wrapping or appending guidance. When a caller invoked the skill, that caller owns the user's continuation. Keep the guidance outside generated artifacts. Honor an explicit request to stop or omit follow-up suggestions.

## Recommend the next action

Use an available skill's actual contract rather than inferring its behavior from its name. Offer alternatives only when they represent a useful choice. When no CE skill fits, recommend the concrete human or external action instead of inventing a skill.

A blocker needs a way forward: name the missing evidence, access, prerequisite, or decision, who can supply it, and how work resumes afterward. Present a decision only the user can settle through the workflow's permitted handoff, with a recommendation where possible. Do not weaken the gate or imply that repeating the same invocation will clear it. Instructions or a checklist do not establish that a requested executable deliverable was built or verified.

Use the existing next-step menu or closing summary rather than adding another menu. Put the recommendation and copyable prompt before a closing question so they are visible while the user chooses. Keep each skill's rules for when it may offer or start another action. A recommendation alone neither invokes a skill nor creates a thread.

## Make continuation copyable

Say whether to continue here or open a new thread in the same project. Follow the user's preference; otherwise keep unresolved dialogue here and recommend a new thread for a distinct stage when its context can be carried reliably. A new-thread prompt must identify the project or checkout, the objective, actual artifact paths or URLs, relevant decisions and constraints, and the expected result. It cannot depend on this conversation. Include a branch or worktree when continuing depends on it. Label temporary or machine-local context accordingly. A saved handoff can carry this context through its existing copyable resume command. When needed context has no saved artifact, carry its substance in the prompt or recommend `ce-handoff` to preserve it first.

For user-copy invocations, default to `/skill-name`; use `$skill-name` on Codex or a host documenting dollar-prefixed invocation. On oh-my-pi (`omp`), use `/skill:<name>` only for a skill that declares `disable-model-invocation` or `hide`. Output one form for the active host. Put the ready-to-paste continuation prompt in one fenced text block, including the invocation when a CE skill fits. Fill known values; request genuinely missing input rather than presenting placeholders as runnable.

If the goal is complete and no useful work remains, say so. Do not manufacture a follow-up task.
