export interface GeminiResponse {
    candidates?: {
        content?: {
            parts?: { text: string }[];
            role?: string;
        };
        finishReason?: string;
        index?: number;
        safetyRatings?: any[];
    }[];
}