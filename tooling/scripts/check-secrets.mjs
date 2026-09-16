import { execFileSync } from "node:child_process";
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bservice_role\b\s*[:=]\s*["'][A-Za-z0-9._-]{20,}/,
  /\b(?:sk_live|sk_test)_[A-Za-z0-9]{16,}/,
];
for (const file of files) {
  const text = execFileSync("git", ["show", `:${file}`], {
    encoding: "utf8",
    maxBuffer: 10_000_000,
  });
  for (const pattern of patterns)
    if (pattern.test(text)) {
      console.error(`Potential secret in ${file}`);
      process.exit(1);
    }
}
console.log("Tracked-file secret pattern scan passed");
