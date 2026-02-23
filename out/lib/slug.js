"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.filePathToSlug = filePathToSlug;
const path = __importStar(require("path"));
/**
 * Derives GA4 pagePath slug from file path.
 * .md/.mdx: relative to contentRoot (e.g. src/content)
 * .astro: relative to pagesRoot (e.g. src/pages)
 */
function filePathToSlug(filePath, workspaceRoot, contentRoot, pagesRoot) {
    const isAstro = filePath.endsWith('.astro');
    const isContent = /\.(md|mdx)$/.test(filePath);
    let absRoot;
    let rel;
    if (isAstro) {
        absRoot = path.join(workspaceRoot, pagesRoot);
        if (!filePath.startsWith(absRoot))
            return null;
        rel = filePath.slice(absRoot.length).replace(/\.astro$/, '');
    }
    else if (isContent) {
        absRoot = path.join(workspaceRoot, contentRoot);
        if (!filePath.startsWith(absRoot))
            return null;
        rel = filePath.slice(absRoot.length).replace(/\.(md|mdx)$/, '');
    }
    else {
        return null;
    }
    rel = rel.replace(/\/index$/, '/');
    if (!rel.startsWith('/'))
        rel = '/' + rel;
    if (!rel.endsWith('/'))
        rel = rel + '/';
    return rel;
}
//# sourceMappingURL=slug.js.map