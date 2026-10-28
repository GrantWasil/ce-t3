import { access, readFile } from "fs/promises"
import path from "path"
import { describe, expect, test } from "bun:test"

const PLUGIN_ROOT = path.join(process.cwd(), "skills")

// The T3 Code dispatch adapter is byte-duplicated into every skill that hands
// work to another agent (the plugin has no cross-skill import mechanism; see
// AGENTS.md "File References in Skills"). Editing one copy without the others
// fails here. Add a skill to CONSUMERS when it gains a copy, together with the
// file that owns its dispatch boundary and loads the adapter.
const ADAPTER = "references/t3-dispatch.md"

const CONSUMERS: Record<string, string[]> = {
  "ce-plan": ["references/reasoning-elevation.md"],
  "ce-brainstorm": ["references/reasoning-elevation.md"],
  "ce-work": ["references/cross-model-execution.md", "references/execution-strategy.md"],
  "ce-code-review": ["references/cross-model-review.md", "references/dispatch-reviewers.md"],
  "ce-doc-review": ["references/cross-model-review.md", "references/dispatch.md"],
  "ce-pov": ["references/cross-model-panel.md"],
  "ce-bakeoff": ["references/candidates.md", "references/judging.md"],
  "ce-simplify-code": ["references/reviewer-dispatch.md"],
  "ce-optimize": ["references/loop.md"],
}

const read = (skill: string, rel: string) => readFile(path.join(PLUGIN_ROOT, skill, rel), "utf8")
const compact = (text: string) => text.replace(/\s+/g, " ")

describe("T3 Code dispatch adapter", () => {
  test(`${ADAPTER} exists in every consumer and is byte-identical`, async () => {
    const skills = Object.keys(CONSUMERS)
    const contents = await Promise.all(
      skills.map(async (skill) => {
        await access(path.join(PLUGIN_ROOT, skill, ADAPTER))
        return read(skill, ADAPTER)
      }),
    )
    for (let i = 1; i < contents.length; i++) {
      expect(contents[i], `${skills[i]} copy drifted from ${skills[0]}`).toBe(contents[0])
    }
  })

  test.each(Object.entries(CONSUMERS).flatMap(([skill, owners]) => owners.map((owner) => [skill, owner])))(
    "%s %s loads the adapter at its dispatch boundary",
    async (skill, owner) => {
      const body = compact(await read(skill, owner))
      expect(body).toContain("`orchestrator_capabilities` and `delegate_task`")
      expect(body).toContain("`references/t3-dispatch.md`")
    },
  )

  // Each pin is a contract the adapter exists to hold; deleting or inverting the
  // rule removes the phrase.
  test("keeps the waiting, ownership, and identity contract", async () => {
    const adapter = compact(await read("ce-plan", ADAPTER))
    // A dispatch acknowledgement is never a result, and running tasks are not polled.
    expect(adapter).toContain("is not a result")
    expect(adapter).toContain("terminal status with no pending child runs")
    expect(adapter).toContain("do not wait for a wake that will not arrive")
    expect(adapter).toContain("Never poll a running task")
    expect(adapter).toContain("call `task_status` once for that task")
    // The parked wait resumes every owed stage, including a waiting caller.
    expect(adapter).toContain("every stage that must still run after delivery")
    expect(adapter).toContain("Ending the turn without a checkpoint, or after a dispatch that has no wake, does not preserve that continuation.")
    // T3 owns the route: no CLI/ACP fallback and no silent substitution.
    expect(adapter).toContain("never fall back to a CLI or ACP runner")
    expect(adapter).toContain("Never substitute another provider, model, or effort")
    // Live catalog decides ids, aliases, and the provider's own option key.
    expect(adapter).toContain("never from memory")
    expect(adapter).toContain("Send options in `target.options` under the live id")
    // Effort is chosen per task unless explicit, and always recorded.
    expect(adapter).toContain("do not apply one level to every dispatch")
    expect(adapter).toContain("record the provider, model, option id, value")
    // Requested is not served; read-only is cooperative.
    expect(adapter).toContain("record the served model and effort as `unverified`")
    expect(adapter).toContain("never describe it as enforced or sandboxed")
    // Cancellation targets owned tasks only.
    expect(adapter).toContain("Cancel with `task_cancel` only tasks this run started")
    // Writers are isolated by T3, verified from git, and integrated by the parent.
    expect(adapter).toContain("Never create a shell worktree for a T3 child")
    expect(adapter).toContain("Verify the result from git, not from the reply")
    expect(adapter).toContain("Verification, canonical commits, and shipping stay with the parent")
    // A same-session skill invocation is not a task.
    expect(adapter).toContain("Never wrap a skill invocation in a delegated task")
  })

  test("lfg lets only a checkpointed T3 wait end the turn before DONE", async () => {
    const body = await read("lfg", "SKILL.md")
    const visibility = compact(await read("lfg", "references/task-visibility.md"))
    expect(body).toContain("the turn ends only at DONE, a stop, or a child's checkpointed T3 Code wait")
    expect(visibility).toContain("That checkpoint names this run's next numbered step as a stage still owed")
    expect(visibility).toContain("Invoking a child skill is never itself a reason to delegate it to a T3 task")
  })

  test("ce-code-review allows ending the turn only at a T3 task's checkpointed wake", async () => {
    const body = await read("ce-code-review", "SKILL.md")
    expect(body).toContain("never end the turn on progress to await it, except at a T3 Code task's checkpointed wake")
  })

  test("T3 implementation checkpoints its plan without delegating to the disabled controller", async () => {
    const body = await read("ce-work", "references/cross-model-execution.md")
    const route = body.split("## T3 Code route")[1]?.split("## Apply preference or requirement strength")[0] ?? ""
    expect(route).toContain('commit --only -m "<checkpoint-message>" -- "<plan>"')
    expect(route).toContain("Preserve any unaccounted-for changes and return blocked")
    expect(route).not.toContain("reset --hard")
  })

  test("T3 finding validators stay byte-identical", async () => {
    expect(await read("ce-code-review", "scripts/t3-findings-valid.jq")).toBe(
      await read("ce-doc-review", "scripts/t3-findings-valid.jq"),
    )
  })

  test("peer routes normalize T3 output through each worker's own --normalize-t3 mode", async () => {
    const cases: Array<[string, string, string]> = [
      ["ce-code-review", "references/cross-model-review.md", "scripts/cross-model-adversarial-review.sh"],
      ["ce-doc-review", "references/cross-model-review.md", "scripts/cross-model-doc-review.sh"],
      ["ce-pov", "references/cross-model-panel.md", "scripts/cross-model-pov.sh"],
    ]
    for (const [skill, owner, script] of cases) {
      const body = compact(await read(skill, owner))
      expect(body, skill).toContain(`$SKILL_DIR/${script}" --normalize-t3`)
      const source = await read(skill, script)
      expect(source, skill).toContain('if [ "${1:-}" = "--normalize-t3" ]; then')
    }
  })
})
