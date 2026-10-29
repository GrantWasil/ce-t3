import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

// Each case spawns bash + jq; keep headroom for a loaded CI runner.
setDefaultTimeout(30_000)

/**
 * Under T3 Code the cross-model peers run as T3 tasks, and each worker script's
 * `--normalize-t3` mode publishes the child's raw output through the same
 * normalization the CLI route uses. These cases pin the identity rules that
 * mode must hold: no served-model claim, independence only from a first-party
 * driver of a different family, peer findings never silent-apply, and nothing
 * published from malformed output.
 */
const SKILLS = path.join(process.cwd(), "skills")
const roots: string[] = []
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "t3-normalize-"))
  roots.push(dir)
  return dir
}
afterAll(() => roots.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

const ENV = { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "/tmp" }

function run(script: string, args: string[]) {
  return spawnSync("bash", [path.join(SKILLS, script), "--normalize-t3", ...args], { encoding: "utf8", env: ENV })
}

const FINDING = {
  title: "t",
  severity: "P1",
  why_it_matters: "A stale cache entry is used.",
  file: "a.ts",
  line: 3,
  confidence: 75,
  autofix_class: "safe_auto",
  owner: "human",
  requires_verification: true,
  pre_existing: false,
  evidence: ["first"],
}
const POV = {
  voice: "x",
  position: "adopt",
  reasoning: "because",
  evidence: ["e"],
  external_check: "ran",
  mode: "independent",
  movement: "initial",
  final: true,
}

type Peer = {
  script: string
  raw: object
  args: (host: string, driver: string, raw: string, dir: string) => string[]
  artifact: (target: string) => string
}

const PEERS: Record<string, Peer> = {
  "code-review": {
    script: "ce-code-review/scripts/cross-model-adversarial-review.sh",
    raw: { findings: [FINDING], residual_risks: [], testing_gaps: [] },
    args: (host, driver, raw, dir) => [host, driver, driver, "model-x", "effort=high", raw, dir, driver === "claudeAgent" ? "claude" : driver],
    artifact: (target) => `adversarial-${target}.json`,
  },
  "doc-review": {
    script: "ce-doc-review/scripts/cross-model-doc-review.sh",
    raw: { findings: [{ ...FINDING, section: "Cache expiry", finding_type: "error" }], residual_risks: [] },
    args: (host, driver, raw, dir) => [host, driver, driver, "model-x", "effort=high", "whole-doc", raw, dir, driver === "claudeAgent" ? "claude" : driver],
    artifact: (target) => `whole-doc-${target}.json`,
  },
  pov: {
    script: "ce-pov/scripts/cross-model-pov.sh",
    raw: POV,
    args: (host, driver, raw, dir) => [host, driver, driver, "model-x", raw, dir, driver === "claudeAgent" ? "claude" : driver],
    artifact: (target) => `pov-${target}.json`,
  },
}

function publish(peer: Peer, host: string, driver: string, raw: object) {
  return publishRaw(peer, host, driver, JSON.stringify(raw))
}

function publishRaw(peer: Peer, host: string, driver: string, raw: string) {
  const dir = temp()
  const rawPath = path.join(dir, "raw.json")
  writeFileSync(rawPath, raw)
  const out = path.join(dir, "out")
  mkdirSync(out)
  return { r: run(peer.script, peer.args(host, driver, rawPath, out)), out }
}

describe("--normalize-t3", () => {
  test.each(Object.keys(PEERS))("%s: a first-party driver of another family attests independence, never the served model", (name) => {
    const peer = PEERS[name]
    const { r, out } = publish(peer, "claude", "codex", peer.raw)
    expect(r.status).toBe(0)
    const artifact = path.join(out, peer.artifact("codex"))
    expect(r.stdout.trim()).toBe(artifact)
    const json = JSON.parse(readFileSync(artifact, "utf8"))
    expect(json.cross_model_route).toBe("t3:codex")
    expect(json.serving_family).toBe("codex")
    expect(json.independence_verified).toBe(true)
    expect(json.model_requested).toBe("model-x")
    expect(json.model_actual).toBe("unverified")
    if (json.findings) expect(json.findings[0].autofix_class).toBe("gated_auto")
  })

  test.each(Object.keys(PEERS))("%s: a relaying driver leaves family unknown and independence false", (name) => {
    const peer = PEERS[name]
    const { r, out } = publish(peer, "claude", "opencode", peer.raw)
    expect(r.status).toBe(0)
    const json = JSON.parse(readFileSync(path.join(out, peer.artifact("opencode")), "utf8"))
    expect(json.serving_family).toBe("unknown")
    expect(json.independence_verified).toBe(false)
  })

  test.each(Object.keys(PEERS))("%s: the host's own family is never independent", (name) => {
    const peer = PEERS[name]
    const { r, out } = publish(peer, "claude", "claudeAgent", peer.raw)
    expect(r.status).toBe(0)
    const json = JSON.parse(readFileSync(path.join(out, peer.artifact("claude")), "utf8"))
    expect(json.independence_verified).toBe(false)
  })

  test.each(Object.keys(PEERS))("%s: malformed output publishes nothing and exits 3", (name) => {
    const peer = PEERS[name]
    const { r, out } = publish(peer, "claude", "codex", { unexpected: true })
    expect(r.status).toBe(3)
    expect(readdirSync(out)).toEqual([])
  })

  const streams = Object.entries(PEERS).flatMap(([name, peer]) => {
    const valid = JSON.stringify(peer.raw)
    return [
      { name, peer, kind: "empty", raw: " \n" },
      { name, peer, kind: "two valid values", raw: `${valid}\n${valid}` },
      { name, peer, kind: "invalid then valid", raw: `{}\n${valid}` },
      { name, peer, kind: "valid then invalid", raw: `${valid}\n{}` },
    ]
  })
  test.each(streams)("$name: rejects $kind without publishing", ({ peer, raw }) => {
    const { r, out } = publishRaw(peer, "claude", "codex", raw)
    expect(r.status).toBe(3)
    expect(r.stdout).toBe("")
    expect(readdirSync(out)).toEqual([])
  })

  test.each(Object.keys(PEERS))("%s: a provider company name is refused as the host family", (name) => {
    const peer = PEERS[name]
    const { r, out } = publish(peer, "anthropic", "codex", peer.raw)
    expect(r.status).toBe(2)
    expect(readdirSync(out)).toEqual([])
  })

  test.each(Object.keys(PEERS))("%s: preserves a Composer target routed through Cursor", (name) => {
    const peer = PEERS[name]
    const dir = temp()
    const raw = path.join(dir, "raw.json")
    writeFileSync(raw, JSON.stringify(peer.raw))
    const out = path.join(dir, "out")
    mkdirSync(out)
    const args = peer.args("claude", "cursor", raw, out)
    args[args.length - 1] = "composer"
    const result = run(peer.script, args)
    expect(result.status).toBe(0)
    const artifact = path.join(out, peer.artifact("composer"))
    expect(result.stdout.trim()).toBe(artifact)
    const json = JSON.parse(readFileSync(artifact, "utf8"))
    expect(json.cross_model_target).toBe("composer")
    expect(json.independence_verified).toBe(false)
    expect(existsSync(path.join(out, peer.artifact("cursor")))).toBe(false)
  })

  test.each(["code-review", "doc-review"])("%s: rejects malformed findings instead of publishing a successful review", (name) => {
    const peer = PEERS[name]
    const { r, out } = publish(peer, "claude", "codex", { findings: [{}] })
    expect(r.status).toBe(3)
    expect(readdirSync(out)).toEqual([])
  })

  test("pov: a non-final position is not published", () => {
    const { r, out } = publish(PEERS.pov, "claude", "codex", { ...POV, final: false })
    expect(r.status).toBe(3)
    expect(existsSync(path.join(out, "pov-codex.json"))).toBe(false)
  })

  test("pov: the published artifact is private", () => {
    const { r, out } = publish(PEERS.pov, "claude", "codex", POV)
    expect(r.status).toBe(0)
    expect(statSync(path.join(out, "pov-codex.json")).mode & 0o777).toBe(0o600)
  })

  test("doc-review: an unlisted reviewer name is refused", () => {
    const dir = temp()
    const rawPath = path.join(dir, "raw.json")
    writeFileSync(rawPath, JSON.stringify(PEERS["doc-review"].raw))
    const r = run(PEERS["doc-review"].script, ["claude", "codex", "codex", "m", "e=h", "../x", rawPath, dir])
    expect(r.status).toBe(2)
  })
})
