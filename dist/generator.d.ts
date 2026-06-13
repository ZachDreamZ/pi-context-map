/**
 * ReportGenerator
 * Generates a visual HTML dashboard based on the ContextMap.
 */
import type { ContextMap } from "./analyzer";
export declare class ReportGenerator {
    static generateHTML(map: ContextMap): string;
    static writeReport(html: string): string;
    private static getOpIcon;
    private static escapeHtml;
}
