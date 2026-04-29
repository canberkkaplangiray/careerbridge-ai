"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [cvText, setCvText] = useState("");
  const [cvFile, setCvFile] = useState(null);
  const [jobText, setJobText] = useState("");
  const [appState, setAppState] = useState("initial"); // initial | loading | results | error
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const canAnalyze = (cvText.trim() || cvFile) && jobText.trim();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (["pdf", "docx", "doc", "txt"].includes(ext)) {
        setCvFile(file);
      } else {
        alert("Lütfen PDF, DOCX veya TXT formatında bir dosya yükleyin.");
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (["pdf", "docx", "doc", "txt"].includes(ext)) {
        setCvFile(file);
      }
    }
  };

  const removeFile = () => {
    setCvFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    setAppState("loading");
    setLoadingStep(0);
    setErrorMsg("");

    try {
      const formData = new FormData();
      if (cvFile) {
        formData.append("cvFile", cvFile);
      }
      formData.append("cvText", cvText);
      formData.append("jobDescription", jobText);

      // Simulate loading steps
      const stepTimer1 = setTimeout(() => setLoadingStep(1), 1500);
      const stepTimer2 = setTimeout(() => setLoadingStep(2), 4000);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analiz sırasında bir hata oluştu.");
      }

      const data = await response.json();
      setResults(data);
      setAppState("results");
    } catch (err) {
      setErrorMsg(err.message || "Beklenmeyen bir hata oluştu.");
      setAppState("error");
    }
  };

  const handleReset = () => {
    setAppState("initial");
    setResults(null);
    setCvText("");
    setCvFile(null);
    setJobText("");
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Score color
  const getScoreColor = (score) => {
    if (score >= 75) return "url(#scoreGradientHigh)";
    if (score >= 50) return "url(#scoreGradientMid)";
    return "url(#scoreGradientLow)";
  };

  const getScoreTextColor = (score) => {
    if (score >= 75) return "#00B894";
    if (score >= 50) return "#FDCB6E";
    return "#E17055";
  };

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <a className="navbar-brand" href="/">
          <div className="navbar-logo">C</div>
          <div>
            <div className="navbar-title">
              Career<span>Bridge</span> AI
            </div>
          </div>
        </a>
        <div className="navbar-tag">✦ AI Destekli</div>
      </nav>

      {/* Hero */}
      {appState !== "results" && (
        <section className="hero">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            Yapay Zeka ile Kariyer Stratejisi
          </div>
          <h1>
            Başvurmadan Önce Kazan:
            <br />
            <span className="gradient-text">CV&apos;ni İşe Göre Optimize Et</span>
          </h1>
          <p className="hero-description">
            Özgeçmişini hedeflediğin iş ilanıyla karşılaştır. Uyumluluk skorunu öğren,
            güçlü ve zayıf yönlerini keşfet, stratejik iyileştirme önerileri al.
          </p>
        </section>
      )}

      {/* Input Zone */}
      {appState === "initial" && (
        <section className="input-zone">
          <div className="input-grid">
            {/* CV Panel */}
            <div className="input-panel">
              <div className="input-panel-header">
                <div className="input-panel-icon cv">📄</div>
                <div>
                  <div className="input-panel-title">Özgeçmişini Yükle</div>
                  <div className="input-panel-subtitle">PDF, DOCX veya metin olarak</div>
                </div>
              </div>

              {!cvFile ? (
                <div
                  className={`file-upload-area ${dragOver ? "drag-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={handleFileChange}
                    id="cv-file-input"
                  />
                  <div className="file-upload-icon">📁</div>
                  <div className="file-upload-text">
                    Dosyanı sürükle bırak veya <strong>gözat</strong>
                  </div>
                  <div className="file-upload-formats">PDF, DOCX, TXT • Maks. 5MB</div>
                </div>
              ) : (
                <div className="file-selected">
                  <span>📎</span>
                  <span className="file-selected-name">{cvFile.name}</span>
                  <button className="file-selected-remove" onClick={removeFile} id="remove-file-btn">
                    ✕
                  </button>
                </div>
              )}

              <div className="input-divider">veya metin yapıştır</div>

              <textarea
                className="text-area"
                placeholder="CV içeriğini buraya yapıştırabilirsin..."
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                id="cv-text-input"
              ></textarea>
            </div>

            {/* Job Panel */}
            <div className="input-panel">
              <div className="input-panel-header">
                <div className="input-panel-icon job">💼</div>
                <div>
                  <div className="input-panel-title">İş İlanını Yapıştır</div>
                  <div className="input-panel-subtitle">İlan metnini veya gereksinimlerini</div>
                </div>
              </div>

              <textarea
                className="text-area job-area"
                placeholder={"İş ilanı metnini buraya yapıştır...\n\nÖrnek:\n- Pozisyon: Frontend Developer\n- Gereksinimler: React, TypeScript, 3+ yıl deneyim...\n- Sorumluluklar: ..."}
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                style={{ minHeight: "320px" }}
                id="job-text-input"
              ></textarea>
            </div>
          </div>

          {/* Analyze Button */}
          <div className="analyze-section">
            <button
              className="analyze-btn"
              disabled={!canAnalyze}
              onClick={handleAnalyze}
              id="analyze-btn"
            >
              <span className="analyze-btn-icon">⚡</span>
              Analiz Et ve Stratejimi Oluştur
            </button>
          </div>
        </section>
      )}

      {/* Loading State */}
      {appState === "loading" && (
        <section className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-text">CV&apos;n Analiz Ediliyor...</div>
          <div className="loading-subtext">Yapay zeka ilanla karşılaştırma yapıyor</div>
          <div className="loading-steps">
            <div className={`loading-step ${loadingStep >= 0 ? "active" : ""} ${loadingStep > 0 ? "done" : ""}`}>
              <span className="loading-step-icon">{loadingStep > 0 ? "✓" : "◉"}</span>
              CV Okunuyor
            </div>
            <div className={`loading-step ${loadingStep >= 1 ? "active" : ""} ${loadingStep > 1 ? "done" : ""}`}>
              <span className="loading-step-icon">{loadingStep > 1 ? "✓" : loadingStep >= 1 ? "◉" : "○"}</span>
              Eşleştirme Yapılıyor
            </div>
            <div className={`loading-step ${loadingStep >= 2 ? "active" : ""}`}>
              <span className="loading-step-icon">{loadingStep >= 2 ? "◉" : "○"}</span>
              Strateji Üretiliyor
            </div>
          </div>
        </section>
      )}

      {/* Error State */}
      {appState === "error" && (
        <section className="loading-overlay">
          <div className="error-panel">
            <div className="error-icon">⚠️</div>
            <div className="error-text">Analiz Tamamlanamadı</div>
            <div className="error-detail">{errorMsg}</div>
            <button className="error-retry-btn" onClick={handleReset} id="error-retry-btn">
              ↻ Tekrar Dene
            </button>
          </div>
        </section>
      )}

      {/* Results Dashboard */}
      {appState === "results" && results && (
        <section className="results-dashboard">
          <div className="results-header">
            <h2>📊 Analiz Sonuçların Hazır</h2>
            <p>CV&apos;n ile hedeflediğin ilan arasındaki uyumluluk raporu</p>
          </div>

          {/* Score Card */}
          <div className="score-section">
            <div className="score-card">
              <div className="score-circle-wrapper">
                <svg viewBox="0 0 180 180" width="180" height="180">
                  <defs>
                    <linearGradient id="scoreGradientHigh" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00B894" />
                      <stop offset="100%" stopColor="#00D2D3" />
                    </linearGradient>
                    <linearGradient id="scoreGradientMid" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FDCB6E" />
                      <stop offset="100%" stopColor="#F39C12" />
                    </linearGradient>
                    <linearGradient id="scoreGradientLow" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#E17055" />
                      <stop offset="100%" stopColor="#D63031" />
                    </linearGradient>
                  </defs>
                  <circle className="score-circle-bg" cx="90" cy="90" r="78" />
                  <circle
                    className="score-circle-progress"
                    cx="90"
                    cy="90"
                    r="78"
                    stroke={getScoreColor(results.compatibilityScore)}
                    strokeDasharray={`${2 * Math.PI * 78}`}
                    strokeDashoffset={`${2 * Math.PI * 78 * (1 - results.compatibilityScore / 100)}`}
                  />
                </svg>
                <div className="score-value">
                  <div className="score-number" style={{ color: getScoreTextColor(results.compatibilityScore) }}>
                    {results.compatibilityScore}
                  </div>
                  <div className="score-percent">%</div>
                </div>
              </div>
              <div className="score-label">Uyumluluk Skoru</div>

              {results.scoreBreakdown && (
                <div className="score-breakdown">
                  <div className="score-breakdown-item">
                    <div className="score-breakdown-value" style={{ color: "#6C5CE7" }}>
                      {results.scoreBreakdown.technicalFit}%
                    </div>
                    <div className="score-breakdown-label">Teknik</div>
                  </div>
                  <div className="score-breakdown-item">
                    <div className="score-breakdown-value" style={{ color: "#00D2D3" }}>
                      {results.scoreBreakdown.experienceFit}%
                    </div>
                    <div className="score-breakdown-label">Deneyim</div>
                  </div>
                  <div className="score-breakdown-item">
                    <div className="score-breakdown-value" style={{ color: "#a855f7" }}>
                      {results.scoreBreakdown.educationFit}%
                    </div>
                    <div className="score-breakdown-label">Eğitim</div>
                  </div>
                  <div className="score-breakdown-item">
                    <div className="score-breakdown-value" style={{ color: "#00B894" }}>
                      {results.scoreBreakdown.softSkillsFit}%
                    </div>
                    <div className="score-breakdown-label">Soft Skills</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Match / Gap Cards */}
          <div className="analysis-grid">
            {/* Matching Skills */}
            <div className="analysis-card match">
              <div className="analysis-card-header">
                <div className="analysis-card-icon match">✓</div>
                <div>
                  <div className="analysis-card-title">Neden Eşleşiyor?</div>
                  <div className="analysis-card-count">
                    {results.matchingSkills?.length || 0} eşleşen yetenek
                  </div>
                </div>
              </div>
              <ul className="skill-list">
                {results.matchingSkills?.map((skill, i) => (
                  <li className="skill-item match" key={i}>
                    <span className="skill-icon">✓</span>
                    <span className="skill-name">
                      {typeof skill === "string" ? skill : skill.skill}
                    </span>
                    {skill.confidence && (
                      <span className={`skill-tag ${skill.confidence === "Yüksek" ? "high" : "medium"}`}>
                        {skill.confidence}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Missing Skills */}
            <div className="analysis-card gap">
              <div className="analysis-card-header">
                <div className="analysis-card-icon gap">!</div>
                <div>
                  <div className="analysis-card-title">Neden Eşleşmiyor?</div>
                  <div className="analysis-card-count">
                    {results.missingSkills?.length || 0} geliştirilecek alan
                  </div>
                </div>
              </div>
              <ul className="skill-list">
                {results.missingSkills?.map((skill, i) => (
                  <li className="skill-item gap" key={i}>
                    <span className="skill-icon">△</span>
                    <span className="skill-name">
                      {typeof skill === "string" ? skill : skill.skill}
                    </span>
                    {skill.importance && (
                      <span className={`skill-tag ${skill.importance === "Kritik" ? "critical" : "medium"}`}>
                        {skill.importance}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Strategic Advice */}
          {results.strategicAdvice && (
            <div className="advice-panel">
              <div className="advice-header">
                <div className="advice-icon">🎯</div>
                <div>
                  <div className="advice-title">Stratejik Tavsiyeler</div>
                  <div className="advice-subtitle">AI tarafından kişiselleştirilmiş öneriler</div>
                </div>
              </div>
              <div className="advice-content">{results.strategicAdvice}</div>
            </div>
          )}

          {/* New Analysis */}
          <div className="new-analysis-section">
            <button className="new-analysis-btn" onClick={handleReset} id="new-analysis-btn">
              ↻ Yeni Analiz Başlat
            </button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="footer">
        <p className="footer-text">
          CareerBridge AI © 2026 — Yapay zeka destekli kariyer analiz platformu
        </p>
      </footer>
    </div>
  );
}
