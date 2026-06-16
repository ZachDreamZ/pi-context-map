/**
 * ReportGenerator
 * Generates a visual HTML dashboard based on the ContextComposition.
 * Apple-inspired design: clean whitespace, SF Pro typography, single blue accent.
 */
import type { ContextComposition } from "./analyzer";
import type { Insight } from "./insights";
export declare class ReportGenerator {
    static generateHTML(composition: ContextComposition, insights: Insight[], contextWindow?: number, actualTokens?: number | null): string;
    private static seg;
    private static getOpIcon;
    private static escapeHtml;
    /** Escape text for use in HTML attributes */
    private static escapeAttr;
}
