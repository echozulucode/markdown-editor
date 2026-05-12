import type { FrontmatterSplit, ParsedMarkdown } from './types.js';
export declare function parseMarkdown(raw: string): ParsedMarkdown;
export declare function serializeMarkdown(parsed: ParsedMarkdown): string;
export declare function replaceBody(parsedOrRaw: ParsedMarkdown | string, newBody: string): string;
export declare function roundTripMarkdown(raw: string): string;
export declare function splitFrontmatter(raw: string): FrontmatterSplit;
//# sourceMappingURL=codec.d.ts.map