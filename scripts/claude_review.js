/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const diffPath = process.argv[2];
if (!diffPath) {
  console.error("Usage: node claude_review.js <path-to-diff>");
  process.exit(1);
}

const apiKey = process.env.CLAUDE_API_KEY;
if (!apiKey) {
  console.error("Missing CLAUDE_API_KEY env var.");
  process.exit(1);
}

const diff = fs
  .readFileSync(path.resolve(diffPath), "utf8")
  .slice(0, 180000); // prevent oversized payloads

const client = new Anthropic({ apiKey });

(async () => {
  const msg = await client.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 1200,
    temperature: 0.2,
    system:
      "You are a senior engineer doing PR review. Be concise. Focus on correctness, security, performance, and tests. Output markdown.",
    messages: [
      {
        role: "user",
        content:
          "Review this PR diff. Provide:\n" +
          "1) Top issues (bullets)\n" +
          "2) Suggested fixes (bullets)\n" +
          "3) Any tests to add (bullets)\n\nDIFF:\n" +
          diff,
      },
    ],
  });

  const text = msg.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  console.log(text.trim());
})();
