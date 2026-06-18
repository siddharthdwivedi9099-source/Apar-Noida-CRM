// Deterministic, dependency-free text chunking used by the knowledge ingestion
// pipeline. Real semantic chunking and embeddings are deferred; this provides
// the chunking structure (boundaries, overlap, token estimates) the RAG
// foundation needs.

const DEFAULT_MAX_CHARS = 600;
const DEFAULT_OVERLAP_CHARS = 80;

export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  // ~4 characters per token is a standard rough estimate.
  return Math.max(1, Math.ceil(text.length / 4));
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

export function chunkText(content: string, options: ChunkOptions = {}): string[] {
  const maxChars = Math.max(50, options.maxChars ?? DEFAULT_MAX_CHARS);
  const overlapChars = Math.max(0, Math.min(options.overlapChars ?? DEFAULT_OVERLAP_CHARS, maxChars - 1));
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) {
    return [];
  }
  if (normalized.length <= maxChars) {
    return [normalized];
  }

  // Split on paragraph and sentence boundaries so chunks stay coherent, then
  // pack the segments into windows that respect the max size with overlap.
  const segments = normalized
    .split(/(\n{2,}|(?<=[.!?])\s+)/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed.length > 0) {
      chunks.push(trimmed);
    }
  };

  for (const segment of segments) {
    if (segment.length > maxChars) {
      // A single oversized segment is hard-split into fixed windows with overlap.
      pushCurrent();
      current = "";
      let start = 0;
      while (start < segment.length) {
        const end = Math.min(segment.length, start + maxChars);
        chunks.push(segment.slice(start, end).trim());
        if (end >= segment.length) {
          break;
        }
        start = end - overlapChars;
      }
      continue;
    }

    if (current.length + segment.length + 1 > maxChars) {
      pushCurrent();
      const overlapTail = overlapChars > 0 ? current.slice(Math.max(0, current.length - overlapChars)) : "";
      current = overlapTail ? `${overlapTail} ${segment}` : segment;
    } else {
      current = current ? `${current} ${segment}` : segment;
    }
  }
  pushCurrent();

  return chunks.length > 0 ? chunks : [normalized.slice(0, maxChars)];
}
