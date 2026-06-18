import { AI_BOTS } from "./signatures";

interface Group {
  agents: string[];
  disallows: string[];
  allows: string[];
}

function parseRobots(robots: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallows: [], allows: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (current && (field === "disallow" || field === "allow")) {
      (field === "disallow" ? current.disallows : current.allows).push(value);
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function fullyBlocks(g: Group): boolean {
  return g.disallows.includes("/") && !g.allows.includes("/");
}

/** True if robots.txt blocks (Disallow: /) any AI crawler — named or via `*`. */
export function robotsBlocksAi(robotsTxt: string | null): boolean {
  if (!robotsTxt) return false;
  const groups = parseRobots(robotsTxt);
  for (const bot of AI_BOTS) {
    const named = groups.filter((g) => g.agents.includes(bot.toLowerCase()));
    if (named.some(fullyBlocks)) return true;
  }
  // Wildcard block also denies AI crawlers that respect robots.
  const wildcard = groups.filter((g) => g.agents.includes("*"));
  return wildcard.some(fullyBlocks);
}
