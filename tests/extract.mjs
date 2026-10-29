// Reads prompt and table declarations out of the extension's modules without importing them.
//
// The extension's files import SillyTavern internals by relative path and run browser-side setup at
// load, so Node cannot import most of them. Tests and tooling instead evaluate the declarations they
// need, which keeps the checks running against the real source rather than a copy.

/**
 * Extracts the literal source of `NAME = [...]` or `NAME = `...``, scanning past brackets and
 * backticks that appear inside string literals. A naive bracket counter stops early on text like
 * `"...[old line, new line]..."`, which silently truncated a table to two of its entries.
 *
 * @param {string} src Module source.
 * @param {string} name Declaration name.
 * @param {'array'|'template'} kind What to extract.
 * @returns {string|null} The literal source body, ready to eval or interpolate, or null if absent.
 */
export function extractLiteral(src, name, kind) {
    const decl = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const ${name} = `);
    const found = decl.exec(src);
    if (!found) return null;
    let i = found.index + found[0].length;

    // Skip to the opening token, allowing wrappers such as migrateReviewPrompt(`...`).
    while (i < src.length && src[i] !== '[' && src[i] !== '`') i++;
    if (i >= src.length) return null;

    const open = src[i];
    const start = i + 1;
    let depth = 1;
    i = start;
    while (i < src.length) {
        const c = src[i];
        if (c === '\\') { i += 2; continue; }
        if (open === '`' && c === '`') break;           // end of template
        if (open === '[') {
            if (c === "'" || c === '"' || c === '`') {  // skip string contents
                const quote = c;
                i++;
                while (i < src.length && src[i] !== quote) { if (src[i] === '\\') i++; i++; }
                i++;
                continue;
            }
            if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
            if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
            if (c === '[') depth++;
            else if (c === ']') { depth--; if (depth === 0) break; }
        }
        i++;
    }
    return src.slice(start, i);
}

/** @returns {string|null} Source of `[...]`, ready for eval. */
export function extractArray(src, name) {
    const body = extractLiteral(src, name, 'array');
    return body === null ? null : '[' + body + ']';
}

/** @returns {string|null} Interior source of a `NAME = `...`` template, ready to interpolate. */
export function extractTemplate(src, name) {
    return extractLiteral(src, name, 'template');
}

/**
 * Evaluates a declaration in a scope of named constants, interpolating the same values the module
 * would. Returns null when the declaration is absent.
 * @param {string} src Module source.
 * @param {string} name Declaration name.
 * @param {Record<string, unknown>} [scope] Names the declaration refers to.
 */
export function evaluate(src, name, scope = {}) {
    const kind = extractLiteral(src, name, 'array') !== null && src.includes(`${name} = [`) ? 'array' : 'template';
    const body = extractLiteral(src, name, kind);
    if (body === null) return null;
    const names = Object.keys(scope);
    const values = Object.values(scope);
    const expression = kind === 'array' ? '[' + body + ']' : '`' + body + '`';
    return new Function(...names, 'return ' + expression + ';')(...values);
}
