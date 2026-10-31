import assert from "node:assert/strict";
import {
  cvss3Score, discoverManifests, parseCsproj, parseGemfileLock, parseGoMod, parseGradle, parsePackageLock,
  parsePipfileLock, parsePnpmLock, parsePom, parseRequirements, parseTomlPackages, parseYarnLock, parseComposerLock,
} from "../lib/deps";
import { computeScore, gradeFor, scanSecrets, wantFile, type Finding } from "../lib/scanner";
import { parseRepoUrl, ScanInputError } from "../lib/github";
import { checkRateLimit } from "../lib/rate-limit";

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; } catch (e) { failures.push(`${name}\n    ${(e as Error).message.split("\n").slice(0, 4).join("\n    ")}`); }
}
const files = (o: Record<string, string>) => new Map(Object.entries(o));
// Built at runtime so this test file does not itself look like it contains secrets.
const AWS = "AKIA" + "IOSFODNN7EXAMPLQ";
const STRIPE = "sk_" + "live_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4";
const GH = "ghp_" + "aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xY3zA5";

/* ---------------- secrets ---------------- */
test("detects an AWS key, private key and live Stripe key", () => {
  const f = scanSecrets(files({
    "src/a.ts": `const k = "${AWS}";`,
    "deploy/key.pem": "-----BEGIN RSA PRIVATE KEY-----\nabc",
    "src/pay.js": `stripe("${STRIPE}")`,
  }));
  assert.equal(f.length, 3);
  assert.ok(f.every((x) => x.severity === "critical" && (x.confidence ?? 0) >= 0.8));
});
test("masks matches to 4 chars + length", () => {
  const f = scanSecrets(files({ "a.ts": `x="${AWS}"` }));
  assert.match(f[0].match!, /^AKIA… \(20 chars\)$/);
  assert.ok(!JSON.stringify(f).includes(AWS));
});
test("same secret in 3 places = one finding with 3 occurrences", () => {
  const f = scanSecrets(files({ "a.ts": `k="${AWS}"`, "b.ts": `k="${AWS}"`, "c/d.ts": `//${AWS}` }));
  assert.equal(f.length, 1);
  assert.equal(f[0].occurrences, 3);
});
test("GitHub tokens: classic and fine-grained", () => {
  assert.equal(scanSecrets(files({ "a.sh": `T=${GH}` })).length, 1);
  assert.equal(scanSecrets(files({ "a.sh": `T=github_pat_${"A1b2C3d4E5".repeat(6)}` })).length, 1);
});
test("unquoted secret in .env.local is found (old scanner missed this file)", () => {
  const f = scanSecrets(files({ ".env.local": "DATABASE_PASSWORD=Zk8#qLm2Xv9pRt4w\nPORT=3000" }));
  assert.ok(f.some((x) => x.type.includes("environment file") || x.type.includes("Committed")));
  assert.ok(f.some((x) => /secret value in environment file/i.test(x.type)));
});
test(".env.example never counts as a secret and generic rules are skipped", () => {
  const f = scanSecrets(files({ ".env.example": "API_KEY=your_api_key_here\nDB_PASSWORD=Zk8#qLm2Xv9pRt4w" }));
  assert.equal(f.length, 0);
});
test("placeholders and env references are ignored", () => {
  const f = scanSecrets(files({
    "a.ts": `const apiKey = "YOUR_API_KEY_HERE"; const password = "changeme123"; const token = "xxxxxxxxxxxx";`,
    "b.ts": `const secret = process.env.SECRET`,
  }));
  assert.equal(f.length, 0);
});
test("localhost database URL is downgraded, remote one is not", () => {
  const local = scanSecrets(files({ "a.ts": `u="mongodb://admin:hunter2pass@localhost:27017/app"` }));
  const remote = scanSecrets(files({ "a.ts": `u="mongodb+srv://admin:Zk8qLm2Xv9@cluster0.abc.mongodb.net/app"` }));
  assert.ok((local[0].confidence ?? 1) < 0.5);
  assert.ok((remote[0].confidence ?? 0) >= 0.8);
});
test("test/fixture paths lower confidence", () => {
  const f = scanSecrets(files({ "tests/fixtures/a.ts": `k="${AWS}"` }));
  assert.ok((f[0].confidence ?? 1) < 0.5);
});
test("EmailJS-style public identifiers are not flagged", () => {
  const f = scanSecrets(files({ "src/Footer.jsx": `emailjs.sendForm('service_x8bqd55','template_anf6hao', f, 'ydZ7L8ppRLWT7-b91')` }));
  assert.equal(f.length, 0);
});
test("Firebase/Google web key is low severity", () => {
  const f = scanSecrets(files({ "src/fb.js": `apiKey: "AIza${"Sy".repeat(2)}A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p"` }));
  assert.equal(f[0]?.severity, "low");
});
test("very long (minified) lines are skipped", () => {
  assert.equal(scanSecrets(files({ "a.js": `${"x".repeat(6000)}${AWS}` })).length, 0);
});
test("wantFile: includes .env.local, keys, lockfiles; excludes node_modules, maps, lock noise", () => {
  assert.ok(wantFile(".env.local", 100));
  assert.ok(wantFile("deploy/id_rsa", 100));
  assert.ok(wantFile("package-lock.json", 5_000_000));
  assert.ok(!wantFile("node_modules/x/index.js", 100));
  assert.ok(!wantFile("src/app.js.map", 100));
  assert.ok(!wantFile("src/huge.js", 5_000_000));
});

/* ---------------- parsers ---------------- */
test("package-lock v3: versions, dev flag, direct flag; skips root and links", () => {
  const lock = JSON.stringify({ lockfileVersion: 3, packages: {
    "": { name: "app" },
    "node_modules/react": { version: "19.0.0" },
    "node_modules/vite": { version: "7.1.10", dev: true },
    "node_modules/a/node_modules/@scope/b": { version: "1.2.3" },
    "node_modules/linked": { link: true },
  } });
  const pkgJson = JSON.stringify({ dependencies: { react: "^19" }, devDependencies: { vite: "^7" } });
  const p = parsePackageLock(lock, "package-lock.json", pkgJson)!;
  assert.equal(p.length, 3);
  assert.equal(p.find((x) => x.name === "vite")!.scope, "dev");
  assert.equal(p.find((x) => x.name === "react")!.direct, true);
  assert.equal(p.find((x) => x.name === "@scope/b")!.direct, false);
});
test("package-lock v1 (nested dependencies)", () => {
  const p = parsePackageLock(JSON.stringify({ lockfileVersion: 1, dependencies: { a: { version: "1.0.0", dependencies: { b: { version: "2.0.0", dev: true } } } } }), "l")!;
  assert.deepEqual(p.map((x) => `${x.name}@${x.version}:${x.scope}`).sort(), ["a@1.0.0:production", "b@2.0.0:dev"]);
});
test("yarn.lock v1 and berry", () => {
  const v1 = `# yarn lockfile v1\n\n"@babel/core@^7.0.0", "@babel/core@^7.1.0":\n  version "7.12.3"\n  resolved "x"\n\nlodash@^4.17.0:\n  version "4.17.19"\n`;
  const p1 = parseYarnLock(v1, "yarn.lock");
  assert.deepEqual(p1.map((x) => `${x.name}@${x.version}`).sort(), ["@babel/core@7.12.3", "lodash@4.17.19"]);
  const berry = `__metadata:\n  version: 6\n\n"lodash@npm:^4.17.0":\n  version: 4.17.21\n  resolution: "lodash@npm:4.17.21"\n\n"app@workspace:.":\n  version: 0.0.0-use.local\n`;
  assert.deepEqual(parseYarnLock(berry, "yarn.lock").map((x) => `${x.name}@${x.version}`), ["lodash@4.17.21"]);
});
test("pnpm-lock v9 and v5", () => {
  const v9 = `lockfileVersion: '9.0'\n\npackages:\n\n  '@babel/core@7.24.0':\n    resolution: {}\n\n  lodash@4.17.21:\n    resolution: {}\n\nsnapshots:\n  'x@1.0.0':\n`;
  assert.deepEqual(parsePnpmLock(v9, "pnpm-lock.yaml").map((x) => `${x.name}@${x.version}`).sort(), ["@babel/core@7.24.0", "lodash@4.17.21"]);
  const v5 = `lockfileVersion: 5.4\n\npackages:\n\n  /lodash/4.17.21:\n    dev: false\n\n  /@types/node/18.0.0:\n    dev: true\n`;
  assert.deepEqual(parsePnpmLock(v5, "pnpm-lock.yaml").map((x) => `${x.name}@${x.version}`).sort(), ["@types/node@18.0.0", "lodash@4.17.21"]);
});
test("requirements.txt: pinned, extras, markers, comments, unpinned counted, dev file", () => {
  const r = parseRequirements(`# deps\nDjango==3.0.0  # web\nrequests[security]==2.19.0 ; python_version>'3'\nflask>=2.0\n-r base.txt\nnumpy\n`, "requirements.txt");
  assert.deepEqual(r.pkgs.map((p) => `${p.name}@${p.version}`), ["django@3.0.0", "requests@2.19.0"]);
  assert.equal(r.unpinned, 2);
  assert.equal(parseRequirements("pytest==7.0.0", "requirements-dev.txt").pkgs[0].scope, "dev");
});
test("Pipfile.lock default/develop", () => {
  const p = parsePipfileLock(JSON.stringify({ default: { Django: { version: "==3.0.0" } }, develop: { pytest: { version: "==7.0.0" } } }), "Pipfile.lock")!;
  assert.deepEqual(p.map((x) => `${x.name}:${x.scope}`).sort(), ["django:production", "pytest:dev"]);
});
test("poetry.lock / uv.lock skip the project itself; Cargo.lock keeps registry crates only", () => {
  const uv = `version = 1\n\n[[package]]\nname = "myapp"\nversion = "0.1.0"\nsource = { virtual = "." }\n\n[[package]]\nname = "Requests"\nversion = "2.19.0"\nsource = { registry = "https://pypi.org/simple" }\n`;
  assert.deepEqual(parseTomlPackages(uv, "uv.lock", "PyPI").map((p) => p.name), ["requests"]);
  const cargo = `[[package]]\nname = "app"\nversion = "0.1.0"\n\n[[package]]\nname = "time"\nversion = "0.1.43"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\n`;
  assert.deepEqual(parseTomlPackages(cargo, "Cargo.lock", "crates.io").map((p) => p.name), ["time"]);
});
test("go.mod block and single-line requires, indirect flag", () => {
  const mod = `module x\n\ngo 1.21\n\nrequire github.com/a/b v1.2.3\n\nrequire (\n\tgithub.com/c/d v0.5.0 // indirect\n\tgolang.org/x/text v0.3.0\n)\n\nreplace github.com/q => ../q\n`;
  const p = parseGoMod(mod, "go.mod");
  assert.deepEqual(p.map((x) => `${x.name}@${x.version}:${x.direct}`).sort(), ["github.com/a/b@1.2.3:true", "github.com/c/d@0.5.0:false", "golang.org/x/text@0.3.0:true"]);
});
test("Gemfile.lock only reads GEM specs and strips platform suffix", () => {
  const lock = `GEM\n  remote: https://rubygems.org/\n  specs:\n    nokogiri (1.13.0-x86_64-linux)\n      racc (~> 1.4)\n    rails (6.0.0)\n\nPLATFORMS\n  ruby\n\nDEPENDENCIES\n  rails\n`;
  assert.deepEqual(parseGemfileLock(lock, "Gemfile.lock").map((p) => `${p.name}@${p.version}`), ["nokogiri@1.13.0", "rails@6.0.0"]);
});
test("composer.lock packages and packages-dev", () => {
  const p = parseComposerLock(JSON.stringify({ packages: [{ name: "a/b", version: "v1.0.0" }], "packages-dev": [{ name: "c/d", version: "2.0.0" }] }), "composer.lock")!;
  assert.deepEqual(p.map((x) => `${x.name}@${x.version}:${x.scope}`).sort(), ["a/b@1.0.0:production", "c/d@2.0.0:dev"]);
});
test("pom.xml resolves properties, skips managed/ranged versions, test scope = dev", () => {
  const pom = `<project><properties><jackson.version>2.9.0</jackson.version></properties>
  <dependencyManagement><dependencies><dependency><groupId>x</groupId><artifactId>y</artifactId><version>9</version></dependency></dependencies></dependencyManagement>
  <dependencies>
   <dependency><groupId>com.fasterxml.jackson.core</groupId><artifactId>jackson-databind</artifactId><version>\${jackson.version}</version></dependency>
   <dependency><groupId>junit</groupId><artifactId>junit</artifactId><version>4.12</version><scope>test</scope></dependency>
   <dependency><groupId>org.springframework</groupId><artifactId>spring-core</artifactId></dependency>
  </dependencies></project>`;
  const { pkgs, unresolved } = parsePom(pom, "pom.xml");
  assert.deepEqual(pkgs.map((p) => `${p.name}@${p.version}:${p.scope}`).sort(), ["com.fasterxml.jackson.core:jackson-databind@2.9.0:production", "junit:junit@4.12:dev"]);
  assert.equal(unresolved, 1);
});
test("gradle string notation and .csproj PackageReference", () => {
  const g = parseGradle(`dependencies {\n  implementation 'org.apache.logging.log4j:log4j-core:2.14.1'\n  testImplementation("junit:junit:4.13")\n}`, "build.gradle");
  assert.deepEqual(g.map((p) => `${p.name}@${p.version}:${p.scope}`).sort(), ["junit:junit@4.13:dev", "org.apache.logging.log4j:log4j-core@2.14.1:production"]);
  assert.equal(parseCsproj(`<PackageReference Include="Newtonsoft.Json" Version="9.0.1" />`, "a.csproj")[0].name, "Newtonsoft.Json");
});
test("discoverManifests: unresolved package.json, unsupported ecosystems, test-folder fixtures ignored", () => {
  const { manifests, ignoredInTests } = discoverManifests(files({
    "package.json": `{"dependencies":{"a":"^1"}}`,
    "pubspec.yaml": "name: x",
    "tests/fixtures/package-lock.json": "{}",
    "api/package.json": `{"dependencies":{"a":"^1"}}`,
    "api/package-lock.json": JSON.stringify({ packages: { "node_modules/a": { version: "1.0.0" } } }),
  }));
  assert.equal(ignoredInTests, 1);
  const status = Object.fromEntries(manifests.map((m) => [m.path, m.status]));
  assert.deepEqual(status, { "package.json": "unresolved", "pubspec.yaml": "unsupported", "api/package-lock.json": "checked" });
});

/* ---------------- cvss ---------------- */
test("CVSS 3.1 reference vectors", () => {
  assert.equal(cvss3Score("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"), 9.8);
  assert.equal(cvss3Score("CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"), 6.1);
  assert.equal(cvss3Score("CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:N"), 0);
  assert.equal(cvss3Score("nonsense"), null);
});

/* ---------------- scoring ---------------- */
const dep = (severity: Finding["severity"], scope: Finding["scope"], weight: number): Finding => ({
  category: "dependency", type: "Vulnerable dependency", severity, weight, description: "", file: "l", line: 0, occurrences: 1, locations: [], scope,
});
test("no findings = 100, grade A", () => {
  const s = computeScore([]);
  assert.equal(s.score, 100);
  assert.equal(gradeFor(s.score), "A");
});
test("REGRESSION: many dependency findings all count (old code scored only the first)", () => {
  const one = computeScore([dep("high", "dev", 1)]).score;
  const many = computeScore(Array.from({ length: 11 }, () => dep("high", "dev", 1))).score;
  assert.ok(many < one, `${many} should be < ${one}`);
});
test("dev-only highs hurt far less than a production high", () => {
  const dev = computeScore(Array.from({ length: 11 }, () => dep("high", "dev", 1)));
  const prod = computeScore([dep("high", "production", 5)]);
  assert.ok(dev.score > 70, String(dev.score));
  assert.ok(prod.score <= 80 && prod.capReason);
});
test("score never saturates at 0 and keeps ordering", () => {
  const a = computeScore(Array.from({ length: 20 }, () => dep("high", "production", 5)));
  const b = computeScore(Array.from({ length: 40 }, () => dep("high", "production", 5)));
  assert.ok(a.score > 0 && b.score > 0 && b.score < a.score);
});
test("a confident critical secret caps the score at 40; a low-confidence one does not", () => {
  const secret = (conf: number): Finding => ({ category: "secret", type: "s", severity: "critical", weight: 10 * conf, description: "", file: "a", line: 1, occurrences: 1, locations: [], confidence: conf });
  assert.equal(computeScore([secret(1)]).score, 40);
  assert.ok(computeScore([secret(0.3)]).score > 40);
});

/* ---------------- input handling ---------------- */
test("parseRepoUrl accepts normal forms and dotted repo names", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/vercel/next.js"), { owner: "vercel", repo: "next.js" });
  assert.deepEqual(parseRepoUrl("https://github.com/a/b.git"), { owner: "a", repo: "b" });
  assert.deepEqual(parseRepoUrl("https://github.com/a/b/tree/main/src"), { owner: "a", repo: "b" });
});
test("parseRepoUrl rejects lookalike hosts, http, credentials, shell metacharacters", () => {
  for (const bad of [
    "https://github.com.evil.com/a/b", "https://evil.com/github.com/a/b", "http://github.com/a/b",
    "https://user:pw@github.com/a/b", "https://github.com/a/$(whoami)", "https://github.com/a;ls/b",
    "https://github.com/a", "https://github.com/a/..", "not a url", "git@github.com:a/b.git",
  ]) assert.throws(() => parseRepoUrl(bad), ScanInputError, bad);
});
test("rate limiter blocks after the window quota", () => {
  const ip = "1.2.3.4";
  for (let i = 0; i < 6; i++) assert.equal(checkRateLimit(ip, 1000).ok, true);
  assert.equal(checkRateLimit(ip, 1001).ok, false);
  assert.equal(checkRateLimit(ip, 1000 + 11 * 60 * 1000).ok, true);
});

console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);