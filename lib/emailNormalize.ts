const ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  '#x27': "'",
  copy: '©',
  reg: '®',
  trade: '™',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(ENTITY_MAP, name)
        ? ENTITY_MAP[name]
        : match
    )
    .replace(/ /g, ' ');
}

export function htmlToText(html: string): string {
  let text = html
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  text = decodeEntities(text);

  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const UNSUBSCRIBE_RE =
  /(unsubscribe|opt.?out|view (this )?(email )?in (your )?browser|manage (your )?(email )?preferences)/i;

export function buildPreview(text: string, maxLength = 140): string {
  // Some senders' "plain text" part (or our htmlBody fallback) is actually
  // raw HTML source — strip tags before decoding so markup never leaks
  // into list previews.
  const decoded = /<[a-z!][\s\S]*>/i.test(text)
    ? htmlToText(text)
    : decodeEntities(text);

  const lines = decoded
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const contentLines: string[] = [];
  for (const line of lines) {
    if (/^>/.test(line)) break;
    if (/^on .+ wrote:$/i.test(line)) break;
    if (/^-{2,}\s*original message\s*-{2,}$/i.test(line)) break;
    if (UNSUBSCRIBE_RE.test(line)) continue;
    contentLines.push(line);
  }

  const joined = (contentLines.length ? contentLines : lines)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (joined.length <= maxLength) return joined;
  return joined.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
}

export interface ParsedSender {
  name: string;
  email: string;
  initials: string;
}

export function parseSender(header: string): ParsedSender {
  const trimmed = header.trim();
  const match = trimmed.match(/^(.*)<([^<>]+)>\s*$/);

  let name: string;
  let email: string;

  if (match) {
    name = match[1].trim().replace(/^"(.*)"$/, '$1').trim();
    email = match[2].trim();
    if (!name) name = email;
  } else {
    name = trimmed;
    email = trimmed;
  }

  const words = name
    .split(/[\s,]+/)
    .filter(Boolean)
    .filter((w) => !/[@<>]/.test(w));

  let initials = '';
  if (words.length >= 2) {
    initials = (words[0][0] + words[words.length - 1][0]).toUpperCase();
  } else if (words.length === 1) {
    initials = words[0].slice(0, 2).toUpperCase();
  } else {
    initials = email.slice(0, 2).toUpperCase();
  }

  return { name, email, initials };
}
