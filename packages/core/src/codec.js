import matter from 'gray-matter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
const FRONTMATTER_FENCE = /^---\r?\n/;
export function parseMarkdown(raw) {
    const { rawFrontmatter, body, hasFrontmatter, frontmatter, trailing } = splitFrontmatter(raw);
    const processor = unified().use(remarkParse).use(remarkGfm);
    const ast = processor.parse(body);
    return {
        raw,
        frontmatter,
        body,
        ast,
        hasFrontmatter,
        rawFrontmatter,
        trailing,
    };
}
export function serializeMarkdown(parsed) {
    return parsed.raw;
}
export function replaceBody(parsedOrRaw, newBody) {
    const parsed = typeof parsedOrRaw === 'string' ? parseMarkdown(parsedOrRaw) : parsedOrRaw;
    return `${parsed.rawFrontmatter}${newBody}${parsed.trailing}`;
}
export function roundTripMarkdown(raw) {
    return serializeMarkdown(parseMarkdown(raw));
}
export function splitFrontmatter(raw) {
    if (!FRONTMATTER_FENCE.test(raw)) {
        return {
            rawFrontmatter: '',
            body: raw,
            hasFrontmatter: false,
            frontmatter: {},
            trailing: '',
        };
    }
    const firstNewline = raw.indexOf('\n');
    if (firstNewline === -1) {
        return {
            rawFrontmatter: '',
            body: raw,
            hasFrontmatter: false,
            frontmatter: {},
            trailing: '',
        };
    }
    const afterOpen = firstNewline + 1;
    const closing = findClosingFence(raw, afterOpen);
    if (closing === -1) {
        return {
            rawFrontmatter: '',
            body: raw,
            hasFrontmatter: false,
            frontmatter: {},
            trailing: '',
        };
    }
    const rawFrontmatter = raw.slice(0, closing.endIdx);
    const body = raw.slice(closing.endIdx);
    let frontmatter = {};
    try {
        const parsed = matter(rawFrontmatter + body);
        frontmatter = (parsed.data ?? {});
    }
    catch {
        frontmatter = {};
    }
    return {
        rawFrontmatter,
        body,
        hasFrontmatter: true,
        frontmatter,
        trailing: '',
    };
}
function findClosingFence(raw, fromIdx) {
    let cursor = fromIdx;
    while (cursor < raw.length) {
        const lineEnd = raw.indexOf('\n', cursor);
        const lineRawEnd = lineEnd === -1 ? raw.length : lineEnd;
        const line = raw.slice(cursor, lineRawEnd).replace(/\r$/, '');
        if (line === '---') {
            const endIdx = lineEnd === -1 ? raw.length : lineEnd + 1;
            return { startIdx: cursor, endIdx };
        }
        if (lineEnd === -1) {
            break;
        }
        cursor = lineEnd + 1;
    }
    return -1;
}
//# sourceMappingURL=codec.js.map