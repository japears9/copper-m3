"use client";

// Ask Copper: the floating shopping chat. Each answer is drawn as a rail of
// stations (the tools on offer, Copper's thinking, each tool call with what
// went in and what came back), then the reply, so shoppers can see how the
// answer was worked out.
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BookOpenIcon,
  BrainIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LifeBuoyIcon,
  MessageCircleIcon,
  SearchXIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SetupRequired } from "@/components/setup-required";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { readLive } from "@/lib/ai/live";
import { askCopper, type ChatMessage } from "@/lib/copper/assistant/ask";
import {
  type Progress,
  type ToolStep,
  TOOL_LABELS,
} from "@/lib/copper/assistant/progress";
import { formatUsd, getPlans, getProducts } from "@/lib/copper/catalog";
import { type CopperDocument, DOCUMENTS } from "@/lib/copper/documents";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

const STARTERS = [
  "How much is Copper Home with Copper Plus, paid yearly, for 2 years?",
  "Is Copper Notes in Night Sky in stock?",
  "Is Copper Plus cheaper monthly or yearly?",
];

/** Short chips for common support questions, answered from the PDFs. */
const SUPPORT_STARTERS = [
  { label: "Error C-47", question: "My Copper Home shows C-47. What do I do?" },
  { label: "Change Wi-Fi", question: "How do I reset Wi-Fi on Copper Home?" },
  {
    label: "Annual refund",
    question: "Can I get a refund on an annual Copper Plus plan?",
  },
  { label: "Warranty", question: "How long is the warranty on Copper Notes?" },
];

type Turn = { question: string; progress: Progress };
type Chats = { tools: Turn[]; noTools: Turn[] };

const WORKING: Progress = { steps: [], reply: "", status: "working" };

export function AskCopper({ aiConfigured }: { aiConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [useTools, setUseTools] = useState(true);
  const [chats, setChats] = useState<Chats>({ tools: [], noTools: [] });
  const [draft, setDraft] = useState("");
  const body = useRef<HTMLDivElement>(null);

  const key = useTools ? "tools" : "noTools";
  const turns = chats[key];
  const busy = turns.at(-1)?.progress.status === "working";

  // Open from the header's #ask link or a page load at /#ask. Clicking the
  // link again fires no hashchange, so listen for the click too.
  useEffect(() => {
    const openOnHash = () => window.location.hash === "#ask" && setOpen(true);
    const openOnClick = (event: MouseEvent) => {
      if ((event.target as Element).closest?.('a[href$="#ask"]')) setOpen(true);
    };
    openOnHash();
    window.addEventListener("hashchange", openOnHash);
    document.addEventListener("click", openOnClick);
    return () => {
      window.removeEventListener("hashchange", openOnHash);
      document.removeEventListener("click", openOnClick);
    };
  }, []);

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [chats, useTools]);

  async function send(question: string) {
    question = question.trim();
    if (!question || busy) return;
    setDraft("");
    const chat = key;
    const index = turns.length;
    // Only finished turns go to the model: questions and Copper's replies.
    const messages: ChatMessage[] = [
      ...turns.flatMap(({ question, progress }): ChatMessage[] => [
        { role: "user", content: question },
        { role: "assistant", content: progress.reply },
      ]),
      { role: "user", content: question },
    ];
    const setProgress = (progress: Progress) =>
      setChats((all) => ({
        ...all,
        [chat]: all[chat].map((turn, i) =>
          i === index ? { ...turn, progress } : turn,
        ),
      }));
    setChats((all) => ({
      ...all,
      [chat]: [...all[chat], { question, progress: WORKING }],
    }));
    try {
      const { progress } = await askCopper({
        messages,
        useTools: chat === "tools",
      });
      for await (const update of readLive(progress)) setProgress(update);
    } catch {
      setProgress({
        steps: [],
        reply: "Sorry, I couldn't reach Copper. Please try again.",
        status: "error",
      });
    }
  }

  return (
    <>
      {!open && (
        <Button
          data-testid="ask-copper-launcher"
          aria-label="Ask Copper"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 h-12 gap-2 rounded-full px-5 shadow-lg sm:right-6 sm:bottom-6"
        >
          <MessageCircleIcon className="size-5" />
          Ask Copper
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          data-testid="ask-copper"
          side="right"
          showCloseButton={false}
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <header className="bg-chart-5 dark:bg-background text-white">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <span className="bg-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                <MessageCircleIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base font-bold text-white">
                  Ask Copper
                </SheetTitle>
                <SheetDescription className="text-xs text-white/70">
                  Prices, stock and support answers, with sources.
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
            {aiConfigured && (
              <div className="flex items-center gap-3 bg-white/10 px-4 py-2">
                <div className="flex-1 text-sm">
                  <span className="font-semibold">Use tools</span>
                  <span className="ml-2 text-xs text-white/70">
                    {useTools ? "Checks every answer" : "Model guesses alone"}
                  </span>
                </div>
                <Switch
                  aria-label="Use tools"
                  checked={useTools}
                  onCheckedChange={setUseTools}
                />
              </div>
            )}
          </header>

          {aiConfigured ? (
            <>
              <div
                ref={body}
                className="bg-secondary flex-1 space-y-6 overflow-y-auto px-4 py-5"
              >
                {turns.map((turn, i) => (
                  <div key={i} className="space-y-4">
                    <p className="bg-primary text-primary-foreground ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2">
                      {turn.question}
                    </p>
                    <Answer progress={turn.progress} useTools={useTools} />
                  </div>
                ))}
                {!busy && (
                  <div className="space-y-2">
                    {turns.length === 0 && (
                      <p className="text-muted-foreground text-sm">
                        Hi, I&apos;m Copper! Ask me about prices, stock or how
                        to use your device. Try one of these:
                      </p>
                    )}
                    {STARTERS.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => send(starter)}
                        className="bg-background hover:border-primary block w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors"
                      >
                        {starter}
                      </button>
                    ))}
                    {turns.length === 0 && useTools && (
                      <div className="pt-3">
                        <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase">
                          <LifeBuoyIcon className="size-3.5" /> Help from our
                          support docs
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {SUPPORT_STARTERS.map(({ label, question }) => (
                            <button
                              key={label}
                              type="button"
                              title={question}
                              onClick={() => send(question)}
                              className="border-accent/40 bg-accent/10 hover:bg-accent rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:text-white"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  send(draft);
                }}
                className="bg-background flex items-center gap-2 border-t p-3"
              >
                <input
                  aria-label="Your question"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask about prices, stock or support…"
                  className="bg-background focus-visible:ring-ring h-10 flex-1 rounded-full border px-4 text-sm outline-none focus-visible:ring-2"
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send"
                  disabled={busy || !draft.trim()}
                  className="size-10 rounded-full"
                >
                  <ArrowUpIcon />
                </Button>
              </form>
            </>
          ) : (
            <div className="bg-secondary flex-1 overflow-y-auto px-4">
              <SetupRequired service="ai" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** One answer: the rail of stations, then Copper's reply. */
function Answer({
  progress,
  useTools,
}: {
  progress: Progress;
  useTools: boolean;
}) {
  const { steps, reply, status } = progress;
  const used = new Set(
    steps.filter((s): s is ToolStep => s.type === "tool").map((s) => s.name),
  );
  const working = status === "working";
  const sources = sourcesOf(reply, steps);
  const notFound = /couldn.t find that in our support docs/i.test(reply);
  let toolCount = 0;
  return (
    <div className="space-y-3">
      <div className="relative space-y-4 pl-9">
        <span
          aria-hidden
          className={cn(
            "absolute top-3 bottom-3 left-[11px] w-0.5 bg-gradient-to-b",
            useTools
              ? "from-primary via-accent to-accent"
              : "from-chart-3 to-chart-3",
          )}
        />
        <Station
          node={<WrenchIcon className="size-3" />}
          nodeClass="bg-muted-foreground"
          label={
            useTools ? "Tools Copper can use" : "Tools given to Copper: none"
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(TOOL_LABELS).map((name) => (
              <span
                key={name}
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono text-xs",
                  !useTools &&
                    "text-muted-foreground bg-background line-through",
                  useTools &&
                    used.has(name) &&
                    "bg-accent font-bold text-white",
                  useTools &&
                    !used.has(name) &&
                    "bg-background text-muted-foreground",
                )}
              >
                {name}
              </span>
            ))}
          </div>
          {!useTools && (
            <p className="text-muted-foreground mt-1.5 text-xs">
              Copper has to answer from memory alone.
            </p>
          )}
        </Station>

        {steps.map((step, i) =>
          step.type === "thinking" ? (
            <Station
              key={i}
              node={<BrainIcon className="size-3" />}
              nodeClass={useTools ? "bg-primary" : "bg-chart-3"}
              label="Copper is thinking"
            >
              <p
                data-testid="thinking"
                className="text-muted-foreground border-l-2 pl-3 text-sm whitespace-pre-wrap italic"
              >
                <InlineMarkdown text={step.text} />
              </p>
            </Station>
          ) : (
            <Station
              key={i}
              node={<WrenchIcon className="size-3" />}
              nodeClass="bg-accent"
              label={
                step.state === "calling"
                  ? "Copper is calling a tool"
                  : "Copper called a tool"
              }
            >
              <ToolCard step={step} number={++toolCount} />
            </Station>
          ),
        )}

        {working && (
          <div className="relative">
            <span className="bg-primary ring-secondary absolute top-0.5 -left-9 flex size-6 animate-pulse items-center justify-center gap-0.5 rounded-full ring-4">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1 animate-bounce rounded-full bg-white"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
            <p className="text-muted-foreground pt-1 text-sm">
              {reply
                ? "Writing the answer…"
                : !useTools
                  ? "Answering from memory…"
                  : steps.length
                    ? "Deciding what to do next…"
                    : "Reading your question…"}
            </p>
          </div>
        )}
      </div>

      {(reply || !working) && (
        <div className="bg-card ml-2 rounded-2xl rounded-tl-sm border p-4 shadow-xs">
          <p className="text-primary mb-1 text-xs font-bold">Copper</p>
          {!useTools && (
            <div className="border-chart-3 bg-chart-3/10 mb-3 rounded-lg border p-3 text-xs">
              <p className="flex items-center gap-1.5 font-bold">
                <TriangleAlertIcon className="text-chart-3 size-4" />
                Answered without tools: may be made up
              </p>
              <p className="text-muted-foreground mt-1">
                With tools off, Copper can&apos;t see today&apos;s prices or
                stock. The AI only has what it learned in training, so it fills
                the gaps with guesses that sound right. That&apos;s a
                hallucination.
              </p>
            </div>
          )}
          {!working && sources.length > 0 && (
            <p className="text-accent mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
              <ShieldCheckIcon className="size-3.5" />
              Checked against {sources.length}{" "}
              {sources.length === 1 ? "page" : "pages"} of our support docs
            </p>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            <WithCitations text={reply} sources={sources} />
            {working && (
              <span className="bg-primary ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle" />
            )}
          </p>
          {!working && notFound && <NotInDocs />}
          {!working && sources.length > 0 && <SourceList sources={sources} />}
        </div>
      )}
    </div>
  );
}

function Station({
  node,
  nodeClass,
  label,
  children,
}: {
  node: ReactNode;
  nodeClass: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="relative">
      <span
        className={cn(
          "ring-secondary absolute top-0 -left-9 flex size-6 items-center justify-center rounded-full text-white ring-4",
          nodeClass,
        )}
      >
        {node}
      </span>
      <p className="text-muted-foreground mb-2 pt-1 text-[11px] font-semibold tracking-widest uppercase">
        {label}
      </p>
      {children}
    </section>
  );
}

/** "[Copper Home User Guide, p. 9]" → that document's title and page. */
const CITATION = /\[([^\[\]]+?),\s*p(?:age|\.)?\s*(\d+)\]/g;

/** The PDF a cited title refers to, matched loosely ("Terms and Conditions" works too). */
function documentFor(title: string) {
  const wanted = title.trim().toLowerCase();
  return (
    DOCUMENTS.find((d) => d.title.toLowerCase() === wanted) ??
    DOCUMENTS.find(
      (d) =>
        d.title.toLowerCase().includes(wanted) ||
        wanted.includes(d.title.toLowerCase()),
    )
  );
}

/** One page Copper cited, numbered in the order it first appears. */
type Source = {
  number: number;
  doc: CopperDocument;
  page: number;
  url: string;
  /** The passage search_docs found on that page, so readers can check it. */
  quote: string | null;
};

const sourceKey = (doc: CopperDocument, page: number) => `${doc.id}#${page}`;

/** The pages a reply cites, each with the passage Copper read there. */
function sourcesOf(reply: string, steps: Progress["steps"]): Source[] {
  /* eslint-disable @typescript-eslint/no-explicit-any -- tool outputs arrive untyped from the stream */
  const found = steps
    .filter((s): s is ToolStep => s.type === "tool" && s.name === "search_docs")
    .flatMap((s) => ((s.output as any)?.passages ?? []) as any[]);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  // Everything Copper said that cites each page, to find the matching quote.
  const claims = new Map<string, string>();
  const sources = new Map<string, Source>();
  let last = 0;
  for (const match of reply.matchAll(CITATION)) {
    const doc = documentFor(match[1]);
    const page = Number(match[2]);
    const claim = reply.slice(last, match.index);
    last = match.index + match[0].length;
    if (!doc) continue;
    const key = sourceKey(doc, page);
    claims.set(key, `${claims.get(key) ?? ""} ${claim}`);
    if (sources.has(key)) continue;
    sources.set(key, {
      number: sources.size + 1,
      doc,
      page,
      url: `${doc.file}#page=${page}`,
      quote: null,
    });
  }
  for (const [key, source] of sources) {
    const passages = found
      .filter(
        (p) =>
          documentFor(String(p.title))?.id === source.doc.id &&
          p.page === source.page,
      )
      .map((p) => String(p.text).replace(/^[^:]+:\s*/, ""));
    source.quote = bestSentence(passages, claims.get(key) ?? "");
  }
  return [...sources.values()];
}

const wordsOf = (text: string) =>
  new Set(text.toLowerCase().match(/[a-z0-9-]{3,}/g) ?? []);

/**
 * The sentence on the cited page that shares the most words with what
 * Copper said, plus the next one when it's short (a table row's answer).
 */
function bestSentence(passages: string[], claim: string): string | null {
  const said = wordsOf(claim);
  let best: { text: string; score: number } | null = null;
  for (const passage of passages) {
    const sentences = passage.split(/(?<=[.!?])\s+/);
    sentences.forEach((sentence, i) => {
      // One sentence, or two in a row (a rule can span a table row).
      for (const text of [sentence, `${sentence} ${sentences[i + 1] ?? ""}`]) {
        const words = wordsOf(text);
        const shared = [...words].filter((w) => said.has(w)).length;
        // Shared words count most; a shorter quote wins a tie.
        const score = shared * 10 - words.size * 0.3;
        if (!best || score > best.score) best = { text: text.trim(), score };
      }
    });
  }
  if (!best) return null;
  // Drop a next section's heading caught at the end, like "4.7 Price changes."
  const text = (best as { text: string }).text
    .replace(/\s+\d+\.\d+\s+[A-Z][A-Za-z ]{0,40}\.?$/, "")
    .trim();
  return focus(text, said);
}

/**
 * Long quotes (a whole table read as one line) start at the words Copper
 * used, so the part that matters isn't cut off. Codes like C-31 come first.
 */
function focus(text: string, said: Set<string>): string {
  if (text.length <= QUOTE_LENGTH) return text;
  const lower = text.toLowerCase();
  const shared = [...said].filter((w) => lower.includes(w));
  const anchor =
    shared.find((w) => /\d/.test(w) && /[a-z]/.test(w)) ??
    shared.sort((a, b) => lower.indexOf(a) - lower.indexOf(b))[0];
  const at = anchor ? lower.indexOf(anchor) : 0;
  if (at < 30) return text;
  const start = text.lastIndexOf(" ", at - 1) + 1;
  return `…${text.slice(start)}`;
}

/** Each kind of document gets its own color, so sources are easy to tell apart. */
const KIND_STYLE: Record<CopperDocument["kind"], string> = {
  "User guide": "bg-accent text-white",
  Terms: "bg-chart-5 text-white dark:text-chart-5 dark:bg-white",
  FAQ: "bg-chart-4 text-chart-5",
};

/**
 * Copper's reply. Each [Document, p. N] citation becomes a small numbered
 * marker: hover it to read the passage, click it to open that PDF page.
 */
function WithCitations({ text, sources }: { text: string; sources: Source[] }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    const doc = documentFor(match[1]);
    const source =
      doc &&
      sources.find((s) => s.doc.id === doc.id && s.page === Number(match[2]));
    if (!doc || !source) continue;
    // Drop the space before the marker so it sits on the word, like a
    // footnote, and keep punctuation Copper put after the citation in front
    // of it, so a "." never starts the next line.
    const after = text.slice(match.index + match[0].length);
    const punctuation = after.match(/^[.,;:!?]+/)?.[0] ?? "";
    const before = text.slice(last, match.index).replace(/\s+$/, "");
    // The last word, its punctuation and the marker never split across lines.
    const lastWord = before.match(/\S*$/)?.[0] ?? "";
    parts.push(before.slice(0, before.length - lastWord.length));
    parts.push(
      <span key={match.index} className="whitespace-nowrap">
        {lastWord + punctuation}
        <Marker source={source} />
      </span>,
    );
    last = match.index + match[0].length + punctuation.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/** A numbered citation: hover it to read the passage, click to open the page. */
function Marker({ source }: { source: Source }) {
  const { doc } = source;
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <a
          data-testid="citation"
          href={source.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Source ${source.number}: ${doc.title}, page ${source.page}`}
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground mx-0.5 inline-flex size-[18px] -translate-y-1.5 items-center justify-center rounded-full border text-[10px] leading-none font-bold no-underline transition-colors"
        >
          {source.number}
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 p-0">
        <SourceHeader source={source} />
        <p className="border-primary text-muted-foreground mx-3 mb-3 border-l-2 pl-2 text-xs italic">
          {source.quote
            ? `“${clip(source.quote, QUOTE_LENGTH)}”`
            : "Open the page to read it."}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

/** How many characters of a quote to show. */
const QUOTE_LENGTH = 200;

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;

function SourceHeader({ source }: { source: Source }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-2">
      <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
        {source.number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{source.doc.title}</p>
        <p className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
          <span
            className={cn(
              "rounded px-1 font-semibold uppercase",
              KIND_STYLE[source.doc.kind],
            )}
          >
            {source.doc.kind}
          </span>
          Page {source.page}
        </p>
      </div>
    </div>
  );
}

/** Under the answer: every page Copper cited, with the passage it read there. */
function SourceList({ sources }: { sources: Source[] }) {
  return (
    <section
      data-testid="source-list"
      className="mt-4 -mx-4 -mb-4 rounded-b-2xl border-t border-dashed"
    >
      <p className="text-muted-foreground flex items-center gap-1.5 px-4 pt-3 text-[11px] font-semibold tracking-widest uppercase">
        <BookOpenIcon className="size-3.5" /> Sources
      </p>
      <ol className="space-y-2 p-3">
        {sources.map((source) => (
          <li
            key={source.number}
            className="bg-secondary/60 overflow-hidden rounded-xl border"
          >
            <SourceHeader source={source} />
            {source.quote && (
              <p className="text-muted-foreground line-clamp-3 px-3 text-xs">
                “{clip(source.quote, QUOTE_LENGTH)}”
              </p>
            )}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary flex items-center gap-1 px-3 py-2 text-xs font-semibold hover:underline"
            >
              Open page {source.page} <ExternalLinkIcon className="size-3" />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** When the docs don't cover it, Copper says so and points to a person. */
function NotInDocs() {
  return (
    <div
      data-testid="not-in-docs"
      className="border-chart-4 bg-chart-4/10 mt-3 flex gap-3 rounded-xl border border-dashed p-3 text-xs"
    >
      <SearchXIcon className="text-chart-3 mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">Not in our support docs</p>
        <p className="text-muted-foreground mt-0.5">
          Copper only answers from the guides, terms and FAQ, so it won&apos;t
          guess. A person on the Copper Crew can help: open the Copper app and
          go to{" "}
          <span className="text-foreground font-medium">Settings › Help</span>.
        </p>
      </div>
    </div>
  );
}

/** Thought summaries arrive as markdown: render **bold** and `code`. */
function InlineMarkdown({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={i} className="text-foreground not-italic">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="font-mono not-italic">
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}

function ToolCard({ step, number }: { step: ToolStep; number: number }) {
  return (
    <div
      data-testid="tool-call"
      data-tool={step.name}
      className="bg-card overflow-hidden rounded-xl border text-sm"
    >
      <div className="bg-accent flex items-center gap-2 px-3 py-2 text-white">
        <span className="font-mono font-bold">{step.name}()</span>
        <span className="rounded bg-white/20 px-1.5 text-[10px]">
          tool {number}
        </span>
        <span className="ml-auto text-xs text-white/80">
          {TOOL_LABELS[step.name] ?? "Using a tool"}
        </span>
      </div>
      <div className="space-y-2 px-3 py-3">
        <p className="text-muted-foreground flex items-center gap-1 text-[11px] font-semibold tracking-widest uppercase">
          <ArrowRightIcon className="size-3" /> What Copper sent
        </p>
        {step.input === undefined ? (
          <p className="text-muted-foreground text-xs italic">
            filling in the details…
          </p>
        ) : (
          <ToolInput name={step.name} input={step.input} />
        )}
      </div>
      <div className="bg-accent/10 space-y-2 border-t px-3 py-3">
        <p className="text-muted-foreground flex items-center gap-1 text-[11px] font-semibold tracking-widest uppercase">
          <ArrowLeftIcon className="size-3" /> What came back
        </p>
        {step.state === "calling" ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner className="size-3" /> the app is running the code…
          </p>
        ) : step.state === "error" ? (
          <p className="text-chart-3 text-xs">{String(step.output)}</p>
        ) : (
          <ToolOutput name={step.name} output={step.output} />
        )}
      </div>
    </div>
  );
}

const NAMES: Record<string, string> = Object.fromEntries([
  ...getProducts().map((p) => [p.id, p.name]),
  ...getPlans().map((p) => [p.id, p.name]),
]);

const nameOf = (value: unknown) =>
  Array.isArray(value)
    ? value.map((v) => NAMES[String(v)] ?? String(v)).join(", ") || "None"
    : (NAMES[String(value)] ?? String(value));

const NO_INPUT: Record<string, string> = {
  get_prices: "Nothing, it just asked for the price list",
  get_products: "Nothing, it just asked what Copper sells",
};

function ToolInput({ name, input }: { name: string; input: unknown }) {
  const entries = Object.entries((input ?? {}) as Record<string, unknown>);
  if (entries.length === 0)
    return (
      <p className="text-muted-foreground text-xs">
        {NO_INPUT[name] ?? "Nothing"}
      </p>
    );
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      {entries.map(([field, value]) => (
        <div key={field} className="contents">
          <dt className="text-muted-foreground capitalize">{field}</dt>
          <dd className="font-medium">{nameOf(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- tool outputs arrive untyped from the stream */
function ToolOutput({ name, output }: { name: string; output: any }) {
  if (name === "calculate_cost" && output?.lines)
    return (
      <div className="text-xs">
        {output.lines.map((line: any) => (
          <div key={line.item} className="flex justify-between py-0.5">
            <span>{line.item}</span>
            <span className="font-mono">{formatUsd(line.usd)}</span>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between border-t pt-2">
          <span className="font-semibold">Total</span>
          <span className="text-primary text-xl font-bold">
            {formatUsd(output.totalUsd)}
          </span>
        </div>
      </div>
    );
  if (name === "get_products" && output?.products)
    return (
      <div className="space-y-2 text-xs">
        {output.products.map((p: any) => (
          <div key={p.id}>
            <div className="flex justify-between font-medium">
              <span>{p.name}</span>
              <span className="font-mono">{formatUsd(p.priceUsd)}</span>
            </div>
            <p className="text-muted-foreground">{p.type}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.colors.map((c: string) => (
                <span key={c} className="bg-accent/15 rounded-full px-2 py-0.5">
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  if (name === "get_prices" && output?.products)
    return (
      <div className="text-xs">
        {output.products.map((p: any) => (
          <div key={p.id} className="flex justify-between py-0.5">
            <span>{p.name}</span>
            <span className="font-mono">{formatUsd(p.priceUsd)}</span>
          </div>
        ))}
        {output.plans
          .filter((p: any) => p.monthlyUsd > 0)
          .map((p: any) => (
            <div key={p.id} className="flex justify-between py-0.5">
              <span>{p.name}</span>
              <span className="font-mono">
                {formatUsd(p.monthlyUsd)}/mo · {formatUsd(p.annualUsd)}/yr
              </span>
            </div>
          ))}
      </div>
    );
  if (name === "check_availability" && output?.status) {
    if (output.status === "unavailable")
      return <p className="text-xs">{output.message}</p>;
    if (output.status === "not_a_color")
      return (
        <p className="text-xs">
          {output.product} doesn&apos;t come in {output.color}. It comes in{" "}
          {output.colors.join(", ")}.
        </p>
      );
    return (
      <div className="space-y-1 text-xs">
        {output.colors.map((c: any) => (
          <div key={c.color} className="flex items-center justify-between">
            <span>{c.color}</span>
            <StockPill stock={c.stock} restockDate={c.restockDate} />
          </div>
        ))}
      </div>
    );
  }
  if (name === "search_docs" && output?.passages)
    return (
      <ol className="space-y-2 text-xs">
        {output.passages.map((p: any, i: number) => (
          <li
            key={i}
            data-testid="doc-passage"
            className="bg-background rounded-lg border p-2"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
              >
                <FileTextIcon className="size-3" />
                {p.title} · p. {p.page}
              </a>
              <span className="text-muted-foreground font-mono">
                {Math.round(p.score * 100)}% match
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-3">
              {String(p.text).replace(/^[^:]+:\s*/, "")}
            </p>
          </li>
        ))}
      </ol>
    );
  // A tool without its own layout yet: show what came back as plain text.
  return (
    <pre className="max-h-48 overflow-auto text-xs whitespace-pre-wrap">
      {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
    </pre>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function StockPill({
  stock,
  restockDate,
}: {
  stock: string;
  restockDate: string | null;
}) {
  if (stock === "in_stock")
    return <Pill className="bg-accent text-white">In stock</Pill>;
  if (stock === "low_stock")
    return <Pill className="bg-chart-4 text-chart-5">Low stock</Pill>;
  const date = restockDate
    ? new Date(`${restockDate}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "later";
  return (
    <Pill className="bg-chart-3 text-white">Back-ordered until {date}</Pill>
  );
}

function Pill({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}
