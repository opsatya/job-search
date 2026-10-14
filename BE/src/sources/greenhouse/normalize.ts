import type { RawJob } from "../types";
import type { Job } from "../../types/job";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
};

// Single pass, so "&amp;lt;" decodes to "&lt;" (not "<") — callers decode
// again after tag-stripping to resolve entities that were nested in markup.
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const codePoint =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// Greenhouse's boards API returns `content` as entity-encoded HTML, so decode
// before stripping tags; block-level closers become line breaks so list items
// and paragraphs stay readable to the LLM.
function stripHtml(html: string): string {
  const text = decodeEntities(
    decodeEntities(html)
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  );
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function normalizeGreenhouseJob(raw: RawJob): Job {
  const isRemote = /remote/i.test(raw.locationText);

  return {
    id: `greenhouse:${raw.sourceJobId}`,
    source: raw.source,
    sourceJobId: raw.sourceJobId,
    company: raw.company,
    title: raw.title,
    description: stripHtml(raw.description),
    url: raw.url,
    locations: [raw.locationText],
    remote: isRemote,
    discoveredAt: new Date(),
    postedAt: raw.postedAt ? new Date(raw.postedAt) : undefined,
    status: "new",
  };
}
