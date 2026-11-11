// @vitest-environment node
import { describe, expect, it } from "vitest";
import index from "@/lib/copper/data/doc-index.json";
import { DOCUMENTS } from "@/lib/copper/documents";
import { cutPage } from "@/lib/copper/docs/passages";
import { pageUrl, rankPassages, TOP_K } from "@/lib/copper/docs/search";

describe("doc index", () => {
  it("has passages from every document, each with a title, page and vector", () => {
    for (const doc of DOCUMENTS) {
      expect(index.passages.some((p) => p.documentId === doc.id)).toBe(true);
    }
    for (const p of index.passages) {
      expect(p.text.startsWith(p.title)).toBe(true);
      expect(p.page).toBeGreaterThan(0);
      expect(p.embedding).toHaveLength(index.dimensions);
    }
  });

  it("cuts a page into passages that start with the title and page", () => {
    const passages = cutPage(
      "Copper Notes User Guide",
      8,
      "Copper Notes User Guide Troubleshooting\nCSL-UG-0201-EN Rev. C 8\n© 2026\nC-31 Storage full. Connect to Wi-Fi.",
    );
    expect(passages).toEqual([
      "Copper Notes User Guide, page 8 (Troubleshooting): C-31 Storage full. Connect to Wi-Fi.",
    ]);
  });

  it("returns the closest passages first, each linked to its PDF page", () => {
    const target = index.passages[10];
    const ranked = rankPassages(target.embedding, index.passages);
    expect(ranked).toHaveLength(TOP_K);
    expect(ranked[0]).toMatchObject({ page: target.page, text: target.text });
    expect(ranked[0].url).toBe(pageUrl(target.documentId, target.page));
    expect(ranked[0].url).toMatch(/^\/docs\/.+\.pdf#page=\d+$/);
  });
});
