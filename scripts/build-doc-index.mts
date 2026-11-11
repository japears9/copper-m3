// Module 3: builds the doc index Ask Copper searches. Run it once, and again
// whenever a PDF in public/docs changes:
//
//   npm run docs:index
//
// It reads every PDF listed in lib/copper/documents.ts, cuts each page into
// passages of a few sentences (each keeps its document title and page
// number), embeds every passage with Gemini, and saves them all to
// lib/copper/data/doc-index.json. The app loads that file into memory, so
// there's no database: four documents fit easily.
import { readFile, writeFile } from "node:fs/promises";
import { register } from "node:module";
import { extractText, getDocumentProxy } from "unpdf";

register("./ts-alias-hook.mjs", import.meta.url);
const { callEmbed, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } =
  await import("@/lib/ai/call");
const { DOCUMENTS } = await import("@/lib/copper/documents");
const { cutPage } = await import("@/lib/copper/docs/passages");

// Load GOOGLE_GENERATIVE_AI_API_KEY from .env.local without printing it.
try {
  process.loadEnvFile(new URL("../.env.local", import.meta.url));
} catch {
  // Already set in the environment, or callEmbed explains what's missing.
}

const root = new URL("../", import.meta.url);
const passages: {
  id: string;
  documentId: string;
  title: string;
  page: number;
  text: string;
}[] = [];

for (const doc of DOCUMENTS) {
  const bytes = await readFile(new URL(`public${doc.file}`, root));
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text: pages } = await extractText(pdf, { mergePages: false });
  let count = 0;
  pages.forEach((pageText, i) => {
    cutPage(doc.title, i + 1, pageText).forEach((text, j) => {
      passages.push({
        id: `${doc.id}-p${i + 1}-${j + 1}`,
        documentId: doc.id,
        title: doc.title,
        page: i + 1,
        text,
      });
      count++;
    });
  });
  console.log(`${doc.title}: ${count} passages from ${pages.length} pages`);
}

const embeddings: number[][] = [];
for (let i = 0; i < passages.length; i += 100) {
  const batch = passages.slice(i, i + 100).map((p) => p.text);
  embeddings.push(
    ...(await callEmbed(
      { module: 3, feature: "build-doc-index" },
      batch,
      "document",
    )),
  );
}

const index = {
  model: `google/${EMBEDDING_MODEL}`,
  dimensions: EMBEDDING_DIMENSIONS,
  builtAt: new Date().toISOString(),
  passages: passages.map((p, i) => ({
    ...p,
    // 6 decimals is plenty for comparing meanings and keeps the file small.
    embedding: embeddings[i].map((x) => Math.round(x * 1e6) / 1e6),
  })),
};
await writeFile(
  new URL("lib/copper/data/doc-index.json", root),
  JSON.stringify(index) + "\n",
);
console.log(
  `Saved ${passages.length} passages to lib/copper/data/doc-index.json`,
);
