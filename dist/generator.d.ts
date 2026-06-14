/**
 * ReportGenerator
 * Generates a visual HTML dashboard based on the ContextMap.
 */
import type { ContextComposition } from "./analyzer";
import type { Insight } from "./insights";
export declare class ReportGenerator {
    static generateHTML(composition: ContextComposition, insights: Insight[]): string;
    static writeReport(html: string): string;
    private static getOpIcon;
    private static escapeHtml;
}
