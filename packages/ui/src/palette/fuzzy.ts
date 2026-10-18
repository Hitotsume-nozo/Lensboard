import type { CommandItem } from './types.js';

export function escapeRegex(query: string): string {
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function safeSearch(query: string, text: string): boolean {
  if (!query) return true;
  const escaped = escapeRegex(query);
  try {
    return new RegExp(escaped, 'i').test(text);
  } catch {
    return text.toLowerCase().includes(query.toLowerCase());
  }
}

export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t === q) return 1000;
  if (t.startsWith(q)) return 500;
  if (t.includes(q)) return 200;

  // Subsequence matching
  let qIdx = 0;
  let score = 0;
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      qIdx++;
      score += 10;
    }
  }

  return qIdx === q.length ? score : 0;
}

export function fuzzySearchCommands(
  commands: CommandItem[],
  query: string
): CommandItem[] {
  const trimmed = query.trim();

  // Boundary f28-b2: empty command palette query displays top recent and starred commands
  if (!trimmed) {
    const defaultList = commands.filter((c) => c.recent || c.starred);
    return defaultList.length > 0 ? defaultList : commands.slice(0, 8);
  }

  const scored = commands
    .map((cmd) => {
      const titleScore = fuzzyScore(trimmed, cmd.title);
      const shortcutScore = cmd.shortcut ? fuzzyScore(trimmed, cmd.shortcut) : 0;
      const totalScore = Math.max(titleScore, shortcutScore);
      return { cmd, score: totalScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.cmd);
}
