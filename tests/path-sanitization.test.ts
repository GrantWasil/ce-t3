import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "node:fs/promises"
import os from "node:os"
import { loadClaudePlugin } from "../src/parsers/claude"
import { sanitizePathName } from "../src/utils/files"
import { writeOpenCodeBundle } from "../src/targets/opencode"
import { writeCodexBundle } from "../src/targets/codex"
import { writePiBundle } from "../src/targets/pi"

const pluginRoot = process.cwd()

describe("sanitizePathName", () => {
  test.each(["", ".", "..", "ns/evil", "ns\\evil", "bad\u0000name", "../evil"])(
    "rejects unsafe path name %j",
    (name) => expect(() => sanitizePathName(name)).toThrow("Invalid component name"),
  )
  test("replaces colons with hyphens", () => {
    expect(sanitizePathName("other:skill")).toBe("other-skill")
    expect(sanitizePathName("other:tool")).toBe("other-tool")
  })

  test("no CE skill name contains a colon", async () => {
    const plugin = await loadClaudePlugin(pluginRoot)
    for (const skill of plugin.skills) {
      expect(skill.name).not.toContain(":")
    }
  })

  test("passes through names without colons", () => {
    expect(sanitizePathName("frontend-design")).toBe("frontend-design")
  })

  test("handles multiple colons", () => {
    expect(sanitizePathName("a:b:c")).toBe("a-b-c")
  })
})

describe("install name validation before writes", () => {
  test.each(["opencode", "codex", "pi"])("%s refuses a traversal plugin name without changing the destination", async (target) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "invalid-plugin-name-"))
    try {
      await fs.writeFile(path.join(root, "install-manifest.json"), "USER DATA\n")
      const write = target === "opencode"
        ? writeOpenCodeBundle(root, { pluginName: "..", config: {}, agents: [], commandFiles: [], plugins: [], skillDirs: [] })
        : target === "codex"
          ? writeCodexBundle(root, { pluginName: "..", prompts: [], generatedSkills: [], skillDirs: [] })
          : writePiBundle(root, { pluginName: "..", prompts: [], generatedSkills: [], skillDirs: [], agents: [], extensions: [] })
      await expect(write).rejects.toThrow("Invalid component name")
      expect(await fs.readFile(path.join(root, "install-manifest.json"), "utf8")).toBe("USER DATA\n")
      expect(await fs.readdir(root)).toEqual(["install-manifest.json"])
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  test("Codex refuses an unsafe skill name before writing otherwise valid prompts", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "invalid-skill-name-"))
    try {
      await expect(writeCodexBundle(root, {
        pluginName: "sample",
        prompts: [{ name: "valid", content: "must not be written" }],
        generatedSkills: [{ name: "ns/evil", content: "must not escape" }],
        skillDirs: [],
      })).rejects.toThrow("Invalid component name")
      expect(await fs.readdir(root)).toEqual([])
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})

describe("path sanitization collision detection", () => {
  test("no two skill names collide after sanitization", async () => {
    const plugin = await loadClaudePlugin(pluginRoot)
    const sanitized = plugin.skills.map((skill) => sanitizePathName(skill.name))
    const unique = new Set(sanitized)

    expect(unique.size).toBe(sanitized.length)
  })

  test("no two agent names collide after sanitization", async () => {
    const plugin = await loadClaudePlugin(pluginRoot)
    const sanitized = plugin.agents.map((agent) => sanitizePathName(agent.name))
    const unique = new Set(sanitized)

    expect(unique.size).toBe(sanitized.length)
  })
})
