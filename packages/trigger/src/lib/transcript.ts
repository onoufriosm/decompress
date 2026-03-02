interface SupadataSegment {
  text: string;
  offset: number;
  duration: number;
  lang?: string;
}

interface SupadataResponse {
  content: SupadataSegment[] | string;
  lang?: string;
  availableLangs?: string[];
}

export interface TranscriptResult {
  content: string;
  language: string;
}

export async function fetchTranscript(
  videoId: string
): Promise<TranscriptResult | null> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    console.error("SUPADATA_API_KEY not configured");
    return null;
  }

  const videoUrl = `https://youtu.be/${videoId}`;
  const apiUrl = `https://api.supadata.ai/v1/transcript?url=${videoUrl}&lang=en`;

  try {
    const response = await fetch(apiUrl, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.error(
        `[${videoId}] Supadata API error: ${response.status} - ${await response.text()}`
      );
      return null;
    }

    const data: SupadataResponse = await response.json();
    const { content } = data;

    let text: string;
    let lang: string | undefined;

    if (Array.isArray(content)) {
      text = content.map((s) => s.text).join(" ");
      lang = content[0]?.lang;
    } else {
      text = content || "";
      lang = data.lang;
    }

    // Clean up whitespace
    text = text.split(/\s+/).join(" ").trim();

    if (!lang) lang = data.lang;

    // Validate English
    if (lang && !lang.toLowerCase().startsWith("en")) {
      console.error(
        `[${videoId}] Transcript not in English (got: ${lang})`
      );
      return null;
    }

    // Validate meaningful content
    if (!text || text.length <= 10) {
      console.error(`[${videoId}] Transcript too short or empty`);
      return null;
    }

    return { content: text, language: lang || "en" };
  } catch (error) {
    console.error(`[${videoId}] Transcript fetch failed:`, error);
    return null;
  }
}
