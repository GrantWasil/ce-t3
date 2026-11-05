import { readdirSync, readFileSync } from "fs"
import path from "path"
import { describe, expect, test } from "bun:test"

const SKILLS_ROOT = path.join(process.cwd(), "skills")

function mentions(skill: string, target: string): boolean {
  const dir = path.join(SKILLS_ROOT, skill)
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".md"))
    .some((file) => readFileSync(path.join(dir, file), "utf8").includes(target))
}

// No single skill owns these relationships, so ce-help's workflow reference states them.
// A failure here means a skill's chain changed: update that reference, then this table.
const STARTS: [string, string][] = [
  ["ce-work", "ce-simplify-code"],
  ["ce-work", "ce-code-review"],
  ["ce-work", "ce-commit-push-pr"],
  ["ce-commit-push-pr", "ce-babysit-pr"],
  ["ce-debug", "ce-code-review"],
  ["ce-debug", "ce-commit-push-pr"],
  ["ce-plan", "ce-doc-review"],
  ["ce-setup", "ce-commit-push-pr"],
  ["lfg", "ce-compound"],
  ["ce-compound-refresh", "ce-compound"],
]

const WORK_CHAIN_WITHOUT_COMPOUND = [
  "ce-work",
  "ce-simplify-code",
  "ce-code-review",
  "ce-commit-push-pr",
  "ce-babysit-pr",
]

describe("ce-help interplay claims", () => {
  test("help uses fork sources and the T3 install guide", () => {
    const help = readFileSync(path.join(SKILLS_ROOT, "ce-help/SKILL.md"), "utf8")
    expect(help).toContain("https://github.com/GrantWasil/ce-t3/blob/main/")
    expect(help).toContain("https://raw.githubusercontent.com/GrantWasil/ce-t3/main/")
    expect(help).toContain("https://github.com/GrantWasil/ce-t3/issues")
    expect(help).not.toContain("EveryInc/compound-engineering-plugin")
    for (const reference of ["starting-and-running.md", "troubleshooting.md"]) {
      expect(readFileSync(path.join(SKILLS_ROOT, "ce-help/references", reference), "utf8"))
        .toContain("docs/install/t3.md")
    }
  })

  test.each(STARTS)("%s still names %s", (skill, target) => {
    expect(mentions(skill, target)).toBe(true)
  })

  test.each(WORK_CHAIN_WITHOUT_COMPOUND)("%s does not start ce-compound", (skill) => {
    expect(mentions(skill, "ce-compound")).toBe(false)
  })
})
