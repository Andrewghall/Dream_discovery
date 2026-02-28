/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const diffPath = process.argv[2];

if (!diffPath) {
  console.error("Usage: node openai_review.js <path-to-diff>");
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("Missing OPENAI_API_KEY environment variable.");
  process.exit(1);
}

const diff = fs
  .readFileSync(path.resolve(diffPath), "utf8")
  .slice(0, 180000); // prevent oversized payloads

const client = new OpenAI({ apiKey });

(async () => {
  const response = await client.responses.create({
    model: "gpt-5.2",
    input: [
      {
        role: "system",
        content:
          "You are a senior software engineer performing a strict pull request review. " +
          "Be concise. Focus on correctness, edge cases, security risks, performance issues, architecture concerns, and missing tests. " +
          "Output markdown only."
      },
      {
        role: "user",
        content:
          "Review this PR diff.\n\n" +
          "Provide:\n" +
          "1) Critical issues\n" +
          "2) Medium concerns\n" +
          "3) Suggested improvements\n" +
          "4) Tests to add\n\n" +
          "DIFF:\n" +
          diff
      }
    ]
  });

  console.log((response.output_text || "").trim());
})().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
