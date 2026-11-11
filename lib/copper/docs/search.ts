// Module 3: search_docs. Finds the passages in Copper's support PDFs whose
// meaning is closest to a question. The index (lib/copper/data/doc-index.json,
// built by `npm run docs:index`) is loaded into memory once; each search only
// embeds the question, then compares it with every passage.
import { cosineSimilarity } from "ai";
import { callEmbed } from "@/lib/ai/call";
import type indexFile from "@/lib/copper/data/doc-index.json";
import { DOCUMENTS } from "@/lib/copper/documents";

/** How many passages each search returns. */
export const TOP_K = 5;

export type DocPassage = {
  title: string;
  page: number;
  /** Opens the PDF at that page, for example /docs/copper-home-user-guide.pdf#page=9 */
  url: string;
  /** How close in meaning to the question, from 0 to 1. */
  score: number;
  text: string;
};

export type DocSearchResult = { query: string; passages: DocPassage[] };

export type IndexedPassage = (typeof indexFile.passages)[number];

// Loaded on the first search (then kept in memory), so pages that only show
// the chat panel don't carry the whole index.
let passagesInMemory: Promise<IndexedPassage[]> | undefined;
const loadPassages = () =>
  (passagesInMemory ??= import("@/lib/copper/data/doc-index.json").then(
    (m) => m.default.passages,
  ));

/** The link that opens a document's PDF at one page. */
export function pageUrl(documentId: string, page: number): string {
  const doc = DOCUMENTS.find((d) => d.id === documentId);
  return `${doc?.file ?? "/docs"}#page=${page}`;
}

/** Ranks passages by closeness to a question's vector; best first. */
export function rankPassages(
  queryVector: number[],
  passages: IndexedPassage[],
  k = TOP_K,
): DocPassage[] {
  return passages
    .map((p) => ({ p, score: cosineSimilarity(queryVector, p.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ p, score }) => ({
      title: p.title,
      page: p.page,
      url: pageUrl(p.documentId, p.page),
      score: Math.round(score * 1000) / 1000,
      text: p.text,
    }));
}

/** search_docs: the 5 passages closest in meaning to the question. */
export async function searchDocs(query: string): Promise<DocSearchResult> {
  const [vector] = await callEmbed(
    { module: 3, feature: "search-docs" },
    [query],
    "query",
  );
  return { query, passages: rankPassages(vector, await loadPassages()) };
}
