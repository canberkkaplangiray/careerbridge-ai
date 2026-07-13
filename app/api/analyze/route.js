import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// Parse uploaded file to text
async function parseFileToText(file) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (fileName.endsWith(".pdf")) {
    const mod = await import("pdf-parse");
    const pdfParse = mod.default || mod;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Desteklenmeyen dosya formatÄ±. PDF, DOCX veya TXT kullanÄ±n.");
}

// Build the analysis prompt
function buildAnalysisPrompt(cvText, jobDescription) {
  return `Sen, kariyer danÄ±ÅŸmanlÄ±ÄŸÄ± ve CV analizi konusunda uzman bir yapay zeka asistanÄ±sÄ±n. Sana bir kiÅŸinin CV'si ve baÅŸvurmak istediÄŸi bir iÅŸ ilanÄ± verilecek. GÃ¶revin, bu ikisini derinlemesine analiz edip aÅŸaÄŸÄ±daki yapÄ±da JSON formatÄ±nda yanÄ±t Ã¼retmektir.

## CV Metni:
${cvText}

## Ä°ÅŸ Ä°lanÄ±:
${jobDescription}

## GÃ¶revlerin:

1. **Uyumluluk Skoru**: CV ile ilan arasÄ±ndaki genel uyumluluÄŸu 0-100 arasÄ± puanla.
2. **Skor DaÄŸÄ±lÄ±mÄ±**: Teknik beceriler, iÅŸ deneyimi, eÄŸitim ve yumuÅŸak beceriler bazÄ±nda ayrÄ± ayrÄ± puanla.
3. **EÅŸleÅŸen Yetenekler**: Ä°landa aranan ve CV'de bulunan becerileri listele. Her biri iÃ§in gÃ¼ven seviyesi ("YÃ¼ksek" veya "Orta") ve CV'den kanÄ±t belirt.
4. **Eksik Yetenekler**: Ä°landa aranan ama CV'de eksik olan becerileri listele. Her biri iÃ§in Ã¶nem derecesi ("Kritik" veya "Orta") ve geliÅŸtirme Ã¶nerisi yaz.
5. **Stratejik Tavsiye**: Adaya Ã¶zel, uygulanabilir tavsiyeler yaz. CV'deki hangi projelerin Ã¶ne Ã§Ä±karÄ±lmasÄ± gerektiÄŸini, eksik becerilerin nasÄ±l telafi edileceÄŸini, cover letter Ã¶nerilerini ve mÃ¼lakat hazÄ±rlÄ±k ipuÃ§larÄ±nÄ± iÃ§ersin. Bu bÃ¶lÃ¼m detaylÄ± ve kiÅŸiselleÅŸtirilmiÅŸ olmalÄ±. TÃ¼rkÃ§e yaz.

## ZORUNLU JSON FORMATI (baÅŸka hiÃ§bir ÅŸey yazma, sadece JSON dÃ¶ndÃ¼r):

{
  "compatibilityScore": <sayÄ±, 0-100>,
  "scoreBreakdown": {
    "technicalFit": <sayÄ±, 0-100>,
    "experienceFit": <sayÄ±, 0-100>,
    "educationFit": <sayÄ±, 0-100>,
    "softSkillsFit": <sayÄ±, 0-100>
  },
  "matchingSkills": [
    {
      "skill": "<beceri adÄ±>",
      "confidence": "<YÃ¼ksek veya Orta>",
      "evidence": "<CV'den kanÄ±t>"
    }
  ],
  "missingSkills": [
    {
      "skill": "<beceri adÄ±>",
      "importance": "<Kritik veya Orta>",
      "suggestion": "<geliÅŸtirme Ã¶nerisi>"
    }
  ],
  "strategicAdvice": "<detaylÄ±, kiÅŸiselleÅŸtirilmiÅŸ tavsiye metni, birden fazla paragraf>"
}`;
}

function extractJsonObject(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI yaniti JSON icermiyor.");
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function removeTrailingCommas(jsonText) {
  return jsonText.replace(/,\s*([}\]])/g, "$1");
}

function parseAnalysisJson(responseText) {
  const jsonText = extractJsonObject(responseText);

  try {
    return JSON.parse(jsonText);
  } catch {
    return JSON.parse(removeTrailingCommas(jsonText));
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const cvFile = formData.get("cvFile");
    let cvText = formData.get("cvText") || "";
    const jobDescription = formData.get("jobDescription") || "";

    // Validate input
    if (!jobDescription.trim()) {
      return NextResponse.json(
        { error: "Ä°ÅŸ ilanÄ± metni gereklidir." },
        { status: 400 }
      );
    }

    // Parse CV file if provided
    if (cvFile && cvFile.size > 0) {
      try {
        const fileText = await parseFileToText(cvFile);
        cvText = fileText + (cvText ? "\n\n" + cvText : "");
      } catch (err) {
        return NextResponse.json(
          { error: `Dosya okuma hatasÄ±: ${err.message}` },
          { status: 400 }
        );
      }
    }

    if (!cvText.trim()) {
      return NextResponse.json(
        { error: "CV metni veya dosyasÄ± gereklidir." },
        { status: 400 }
      );
    }

    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API anahtarÄ± yapÄ±landÄ±rÄ±lmamÄ±ÅŸ. .env.local dosyasÄ±na GEMINI_API_KEY ekleyin." },
        { status: 500 }
      );
    }

    // Define strict JSON schema for Gemini response to ensure zero JSON parse errors
    const responseSchema = {
      type: "OBJECT",
      properties: {
        compatibilityScore: { type: "INTEGER" },
        scoreBreakdown: {
          type: "OBJECT",
          properties: {
            technicalFit: { type: "INTEGER" },
            experienceFit: { type: "INTEGER" },
            educationFit: { type: "INTEGER" },
            softSkillsFit: { type: "INTEGER" }
          },
          required: ["technicalFit", "experienceFit", "educationFit", "softSkillsFit"]
        },
        matchingSkills: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              skill: { type: "STRING" },
              confidence: { type: "STRING" },
              evidence: { type: "STRING" }
            },
            required: ["skill", "confidence", "evidence"]
          }
        },
        missingSkills: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              skill: { type: "STRING" },
              importance: { type: "STRING" },
              suggestion: { type: "STRING" }
            },
            required: ["skill", "importance", "suggestion"]
          }
        },
        strategicAdvice: { type: "STRING" }
      },
      required: [
        "compatibilityScore",
        "scoreBreakdown",
        "matchingSkills",
        "missingSkills",
        "strategicAdvice"
      ]
    };

    // Call Gemini API with model fallback chain
    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = buildAnalysisPrompt(cvText.trim(), jobDescription.trim());

    // Try multiple models in order - different models have separate quota pools
    const modelCandidates = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ];

    let responseText;
    let lastError;

    for (const modelName of modelCandidates) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
          },
        });
        const result = await model.generateContent(prompt);
        const candidateText = result.response.text();
        parseAnalysisJson(candidateText);
        responseText = candidateText;
        lastError = null;
        console.log(`Success with model: ${modelName}`);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} failed: ${err.message?.substring(0, 100)}`);
        if (err.message?.includes("429") || err.message?.includes("quota")) {
          // Rate limited - try next model immediately to avoid serverless timeout
          continue;
        }
        if (err.message?.includes("404") || err.message?.includes("not found")) {
          // Model not found - try next
          continue;
        }
        // Other error - still try next model
        continue;
      }
    }

    if (lastError || !responseText) {
      throw new Error(
        "TÃ¼m AI modelleri ÅŸu an meÅŸgul. LÃ¼tfen 1 dakika bekleyip tekrar deneyin."
      );
    }

    // Parse JSON response
    let analysisResult;
    try {
      analysisResult = parseAnalysisJson(responseText);
    } catch (err) {
      console.error("Invalid AI JSON response:", {
        error: err.message,
        preview: responseText?.slice(0, 500),
      });
      throw new Error("AI yaniti beklenen formatta gelmedi. Lutfen tekrar deneyin.");
    }

    // Validate and ensure required fields
    const response = {
      compatibilityScore: Math.min(100, Math.max(0, analysisResult.compatibilityScore || 0)),
      scoreBreakdown: {
        technicalFit: analysisResult.scoreBreakdown?.technicalFit || 0,
        experienceFit: analysisResult.scoreBreakdown?.experienceFit || 0,
        educationFit: analysisResult.scoreBreakdown?.educationFit || 0,
        softSkillsFit: analysisResult.scoreBreakdown?.softSkillsFit || 0,
      },
      matchingSkills: analysisResult.matchingSkills || [],
      missingSkills: analysisResult.missingSkills || [],
      strategicAdvice: analysisResult.strategicAdvice || "",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Analiz sÄ±rasÄ±nda beklenmeyen bir hata oluÅŸtu." },
      { status: 500 }
    );
  }
}
