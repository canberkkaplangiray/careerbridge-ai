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

  throw new Error("Desteklenmeyen dosya formatı. PDF, DOCX veya TXT kullanın.");
}

// Build the analysis prompt
function buildAnalysisPrompt(cvText, jobDescription) {
  return `Sen, kariyer danışmanlığı ve CV analizi konusunda uzman bir yapay zeka asistanısın. Sana bir kişinin CV'si ve başvurmak istediği bir iş ilanı verilecek. Görevin, bu ikisini derinlemesine analiz edip aşağıdaki yapıda JSON formatında yanıt üretmektir.

## CV Metni:
${cvText}

## İş İlanı:
${jobDescription}

## Görevlerin:

1. **Uyumluluk Skoru**: CV ile ilan arasındaki genel uyumluluğu 0-100 arası puanla.
2. **Skor Dağılımı**: Teknik beceriler, iş deneyimi, eğitim ve yumuşak beceriler bazında ayrı ayrı puanla.
3. **Eşleşen Yetenekler**: İlanda aranan ve CV'de bulunan becerileri listele. Her biri için güven seviyesi ("Yüksek" veya "Orta") ve CV'den kanıt belirt.
4. **Eksik Yetenekler**: İlanda aranan ama CV'de eksik olan becerileri listele. Her biri için önem derecesi ("Kritik" veya "Orta") ve geliştirme önerisi yaz.
5. **Stratejik Tavsiye**: Adaya özel, uygulanabilir tavsiyeler yaz. CV'deki hangi projelerin öne çıkarılması gerektiğini, eksik becerilerin nasıl telafi edileceğini, cover letter önerilerini ve mülakat hazırlık ipuçlarını içersin. Bu bölüm detaylı ve kişiselleştirilmiş olmalı. Türkçe yaz.

## ZORUNLU JSON FORMATI (başka hiçbir şey yazma, sadece JSON döndür):

{
  "compatibilityScore": <sayı, 0-100>,
  "scoreBreakdown": {
    "technicalFit": <sayı, 0-100>,
    "experienceFit": <sayı, 0-100>,
    "educationFit": <sayı, 0-100>,
    "softSkillsFit": <sayı, 0-100>
  },
  "matchingSkills": [
    {
      "skill": "<beceri adı>",
      "confidence": "<Yüksek veya Orta>",
      "evidence": "<CV'den kanıt>"
    }
  ],
  "missingSkills": [
    {
      "skill": "<beceri adı>",
      "importance": "<Kritik veya Orta>",
      "suggestion": "<geliştirme önerisi>"
    }
  ],
  "strategicAdvice": "<detaylı, kişiselleştirilmiş tavsiye metni, birden fazla paragraf>"
}`;
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
        { error: "İş ilanı metni gereklidir." },
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
          { error: `Dosya okuma hatası: ${err.message}` },
          { status: 400 }
        );
      }
    }

    if (!cvText.trim()) {
      return NextResponse.json(
        { error: "CV metni veya dosyası gereklidir." },
        { status: 400 }
      );
    }

    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API anahtarı yapılandırılmamış. .env.local dosyasına GEMINI_API_KEY ekleyin." },
        { status: 500 }
      );
    }

    // Call Gemini API with model fallback chain
    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = buildAnalysisPrompt(cvText.trim(), jobDescription.trim());

    // Try multiple models in order - different models have separate quota pools
    const modelCandidates = [
      "gemini-2.0-flash-lite",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
    ];

    let responseText;
    let lastError;

    for (const modelName of modelCandidates) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        lastError = null;
        console.log(`Success with model: ${modelName}`);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} failed: ${err.message?.substring(0, 100)}`);
        if (err.message?.includes("429") || err.message?.includes("quota")) {
          // Rate limited - try next model
          await new Promise((r) => setTimeout(r, 2000));
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
        "Tüm AI modelleri şu an meşgul. Lütfen 1 dakika bekleyip tekrar deneyin."
      );
    }

    // Parse JSON response
    let analysisResult;
    try {
      analysisResult = JSON.parse(responseText);
    } catch {
      // Try extracting JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI yanıtı geçerli bir JSON formatında değil.");
      }
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
      { error: error.message || "Analiz sırasında beklenmeyen bir hata oluştu." },
      { status: 500 }
    );
  }
}
