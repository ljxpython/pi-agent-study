/** Render the application's generated Markdown subset using text nodes only.
 * Raw HTML, scripts, links and external images are never interpreted.
 */
function text(value: string): string {
  return value.replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function cellValues(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(value => text(value.trim()));
}

/** Assistant Markdown is untrusted: build a small readable subset with DOM nodes.
 * HTML and images stay visible as text; only explicit HTTP(S) links become links.
 */
function appendInline(parent: HTMLElement, value: string): void {
  const tokens = /\\([\\`*_{}\[\]()#+\-.!|>])|`([^`\n]+)`|\*\*(.+?)\*\*|__(.+?)__|\*([^*\n]+)\*|_([^_\n]+)_|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let cursor = 0;
  for (const match of value.matchAll(tokens)) {
    parent.append(document.createTextNode(value.slice(cursor, match.index)));
    // Markdown underscores inside identifiers are literal, e.g. LONG_UNBROKEN_TOKEN_.
    if ((match[4] || match[6]) && (/[\p{L}\p{N}]/u.test(value[match.index - 1] ?? '') ||
        /[\p{L}\p{N}]/u.test(value[match.index + match[0].length] ?? ''))) {
      parent.append(document.createTextNode(match[0]));
      cursor = match.index + match[0].length;
      continue;
    }
    let node: HTMLElement | null = null;
    if (match[2]) { node = document.createElement('code'); node.textContent = match[2]; }
    else if (match[3] || match[4]) { node = document.createElement('strong'); node.textContent = match[3] ?? match[4]; }
    else if (match[5] || match[6]) { node = document.createElement('em'); node.textContent = match[5] ?? match[6]; }
    else if (match[7] && value[match.index - 1] !== '!') {
      try {
        const url = new URL(match[8]);
        if (!url.username && !url.password) {
          const link = document.createElement('a');
          link.href = url.href; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer';
          link.target = '_blank'; link.textContent = match[7]; node = link;
        }
      } catch { /* Malformed links remain plain text. */ }
    }
    parent.append(node ?? document.createTextNode(match[1] ?? match[0]));
    cursor = match.index + match[0].length;
  }
  parent.append(document.createTextNode(value.slice(cursor)));
}

export function chatMarkdown(markdown: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'message-text message-markdown';
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const tableStart = (index: number) => lines[index]?.trim().startsWith('|') &&
    /^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[index + 1] ?? '');
  const block = (line: string) => /^(?:\s*[-*+]\s+|\s*\d+\.\s+|#{1,6}\s+|```|>\s?)/.test(line);
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (tableStart(index)) {
      const wrapper = document.createElement('div');
      wrapper.className = 'markdown-table';
      const table = document.createElement('table');
      const header = table.createTHead().insertRow();
      for (const value of cellValues(line)) {
        const cell = document.createElement('th'); cell.textContent = value; header.append(cell);
      }
      index += 2;
      const body = table.createTBody();
      while (lines[index]?.trim().startsWith('|')) {
        const row = body.insertRow();
        for (const value of cellValues(lines[index])) row.insertCell().textContent = value;
        index++;
      }
      wrapper.append(table); root.append(wrapper); continue;
    }
    if (line.startsWith('```')) {
      const code = document.createElement('code');
      const body: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith('```')) body.push(lines[index++]);
      if (index < lines.length) index++;
      code.textContent = body.join('\n');
      const pre = document.createElement('pre'); pre.append(code); root.append(pre);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const title = document.createElement(`h${Math.min(heading[1].length + 2, 6)}`);
      appendInline(title, heading[2]); root.append(title); index++; continue;
    }
    const list = /^\s*([-*+]\s+|\d+\.\s+)(.+)$/.exec(line);
    if (list) {
      const ordered = /^\d/.test(list[1]);
      const container = document.createElement(ordered ? 'ol' : 'ul');
      while (index < lines.length) {
        const item = /^\s*([-*+]\s+|\d+\.\s+)(.+)$/.exec(lines[index]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        const entry = document.createElement('li'); appendInline(entry, item[2]);
        container.append(entry); index++;
      }
      root.append(container); continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = document.createElement('blockquote');
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        if (quote.hasChildNodes()) quote.append(document.createElement('br'));
        appendInline(quote, lines[index++].replace(/^>\s?/, ''));
      }
      root.append(quote); continue;
    }
    const paragraph = document.createElement('p');
    do {
      if (paragraph.hasChildNodes()) paragraph.append(document.createElement('br'));
      appendInline(paragraph, lines[index++]);
    } while (index < lines.length && lines[index].trim() && !block(lines[index]) && !tableStart(index));
    root.append(paragraph);
  }
  return root;
}
export function reportPreview(markdown: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'report-preview markdown-preview';
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (line.startsWith('|') && /^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[index + 1] ?? '')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'markdown-table';
      const table = document.createElement('table');
      const header = table.createTHead().insertRow();
      for (const value of cellValues(line)) {
        const cell = document.createElement('th'); cell.textContent = value; header.append(cell);
      }
      index++;
      const body = table.createTBody();
      while (lines[index + 1]?.startsWith('|')) {
        const row = body.insertRow();
        for (const value of cellValues(lines[++index])) row.insertCell().textContent = value;
      }
      wrapper.append(table); root.append(wrapper); continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line);
    if (item) {
      let list = root.lastElementChild;
      if (list?.tagName !== 'UL') { list = document.createElement('ul'); root.append(list); }
      const entry = document.createElement('li'); entry.textContent = text(item[1]); list.append(entry);
    } else {
      const element = document.createElement(heading ? `h${Math.min(heading[1].length + 2, 6)}` : 'p');
      element.textContent = text(heading ? heading[2] : line); root.append(element);
    }
  }
  return root;
}
