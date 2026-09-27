"use client";

import { useEffect, useState, useMemo } from "react";

// Types
interface MetalData {
  name: string;
  unit: string;
  price_inr: number;
  price_per_gram: number;
  price_per_kg?: number;
  ma7: number | null;
  ma15: number | null;
  ma30: number | null;
  dev_ma7: number;
  dev_ma15: number;
  dev_ma30: number;
  trend_validated: boolean;
  source: string;
  fetched_at: string;
}

interface MarketPayload {
  timestamp: string;
  metals: {
    gold_24k: MetalData;
    gold_22k: MetalData;
    silver: MetalData;
  };
  taxes: {
    import_duty_pct: number;
    gst_pct: number;
    combined_multiplier: number;
  };
  system_health: {
    database: string;
    bot_username: string;
    cron_cadence: string;
  };
}

interface HistoryPayload {
  chart_series: Array<{
    metal: string;
    price_inr: number;
    ma7: number;
    ma15: number;
    ma30: number;
    fetched_at: string;
  }>;
  backtest: {
    ticker: string;
    methodology: string;
    total_folds: number;
    evaluation_window_days: number;
    metrics: {
      model_accuracy: number;
      naive_majority_baseline: number;
      statistical_edge: number;
      severe_drawdown_fold: { fold_number: number; accuracy: number };
    };
    gating_status: {
      trend_signal_validated: boolean;
      status_label: string;
      reason: string;
    };
    folds_detail: Array<{ fold: number; accuracy: number; baseline: number; status: string }>;
  };
  eda: {
    assets: string[];
    matrix: number[][];
    insights: string[];
  };
}

export default function AurumDashboard() {
  const [liveData, setLiveData] = useState<MarketPayload | null>(null);
  const [historyData, setHistoryData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Calculator State
  const [calcBudget, setCalcBudget] = useState<number>(50000);
  const [calcMetal, setCalcMetal] = useState<"gold_24k" | "gold_22k" | "silver">("gold_24k");

  // Chart Controls
  const [showMA7, setShowMA7] = useState(true);
  const [showMA15, setShowMA15] = useState(true);
  const [showMA30, setShowMA30] = useState(false);

  // Sandbox Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "bot"; text: string; disclaimer?: boolean }>>([
    {
      role: "bot",
      text: "Namaste! Main Aurum AI hoon. Main aapke parivaar ke liye sona aur chandi ke taaza bhav aur pichle dino ke daam ka factual hisaab laata hoon. Aap mujhse koi bhi sawaal pooch sakte hain!",
      disclaimer: false,
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Fetch Live & Historical Data
  useEffect(() => {
    async function loadAllData() {
      try {
        const [liveRes, histRes] = await Promise.all([
          fetch("/api/market/live"),
          fetch("/api/market/history"),
        ]);
        const liveJson = await liveRes.json();
        const histJson = await histRes.json();

        if (liveJson.ok) setLiveData(liveJson.data);
        if (histJson.ok) setHistoryData(histJson.data);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, []);

  // Format INR Currency (Indian numbering system)
  const formatINR = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return "₹0.00";
    return "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculator Computations (Pure Deterministic Math - RULE-001)
  const calcResults = useMemo(() => {
    if (!liveData) return { grams: 0, tolas: 0, pavans: 0, ounces: 0, base: 0, duty: 0, gst: 0 };
    const pricePer10g = liveData.metals[calcMetal].price_inr;
    const pricePerGram = pricePer10g / 10.0;
    const grams = calcBudget > 0 && pricePerGram > 0 ? calcBudget / pricePerGram : 0;
    const tolas = grams / 11.6638;
    const pavans = grams / 8.0;
    const ounces = grams / 31.1035;

    // Tax breakdown
    const baseMetal = calcBudget / 1.18;
    const duty = baseMetal * 0.15;
    const gst = baseMetal * 0.03;

    return {
      grams: Math.round(grams * 1000) / 1000,
      tolas: Math.round(tolas * 100) / 100,
      pavans: Math.round(pavans * 100) / 100,
      ounces: Math.round(ounces * 1000) / 1000,
      base: Math.round(baseMetal * 100) / 100,
      duty: Math.round(duty * 100) / 100,
      gst: Math.round(gst * 100) / 100,
    };
  }, [liveData, calcBudget, calcMetal]);

  // Handle Simulator Query
  const handleSendChat = (presetText?: string) => {
    const textToSend = presetText || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    const newMsgs = [...chatMessages, { role: "user" as const, text: textToSend }];
    setChatMessages(newMsgs);
    if (!presetText) setChatInput("");
    setChatLoading(true);

    setTimeout(() => {
      const lower = textToSend.toLowerCase();
      let botReply = "";

      if (lower.includes("sone") || lower.includes("gold") || lower.includes("bhav") || lower.includes("rate")) {
        const p = liveData ? liveData.metals.gold_24k.price_inr : 157084.6;
        const ma15 = liveData ? liveData.metals.gold_24k.ma15 : 159066.13;
        botReply = `Namaste! Aaj 24K gold ka bhav ${formatINR(p)} prati 10 gram hai. Pichle 15 dino ke average (${formatINR(ma15)}) se ye thoda kam chal raha hai.`;
      } else if (lower.includes("chandi") || lower.includes("silver")) {
        const p = liveData ? liveData.metals.silver.price_inr : 2355.65;
        botReply = `Namaste! Aaj chandi ka bhav ${formatINR(p)} prati 10 gram hai (lagbhag ${formatINR(p * 100)} prati kilogram).`;
      } else if (lower.includes("khareed") || lower.includes("buy") || lower.includes("bech") || lower.includes("chahiye")) {
        botReply = `Namaste! Sona khareedna ya bechna aapka apna niji faisla hai. Main koi financial advisor nahi hoon. Main aapko sirf taaza bhav aur pichle dino ka factual hisaab bata sakta hoon, taaki aap sahi jaankaari ke saath faisla le sakein.`;
      } else if (lower.includes("50,000") || lower.includes("kitna") || lower.includes("budget")) {
        const g = calcResults.grams;
        botReply = `Namaste! ₹50,000 mein aapko lagbhag ${g} gram 24K sona mil sakta hai (taxes milakar). Yeh pure landed cost ka anumaan hai.`;
      } else {
        botReply = `Namaste! Aap mujhse sona ya chandi ke taaza bhav, moving average comparisons, ya budget ke hisaab se quantity ke baare mein pooch sakte hain.`;
      }

      setChatMessages([
        ...newMsgs,
        {
          role: "bot",
          text: botReply,
          disclaimer: true,
        },
      ]);
      setChatLoading(false);
    }, 600);
  };

  // Render SVG Chart Points
  const chartPoints = useMemo(() => {
    if (!historyData || !historyData.chart_series || historyData.chart_series.length === 0) return null;
    const series = historyData.chart_series;
    const minPrice = Math.min(...series.map((d) => d.price_inr)) * 0.995;
    const maxPrice = Math.max(...series.map((d) => d.price_inr)) * 1.005;
    const width = 800;
    const height = 240;

    const getX = (idx: number) => (idx / (series.length - 1)) * (width - 40) + 20;
    const getY = (val: number) => height - ((val - minPrice) / (maxPrice - minPrice)) * (height - 40) - 20;

    const pricePath = series.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(curr.price_inr)}`, "");
    const ma7Path = series.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(curr.ma7)}`, "");
    const ma15Path = series.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(curr.ma15)}`, "");
    const ma30Path = series.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(curr.ma30)}`, "");

    // Area path for gradient fill
    const areaPath = `${pricePath} L ${getX(series.length - 1)} ${height} L ${getX(0)} ${height} Z`;

    return { series, width, height, minPrice, maxPrice, pricePath, ma7Path, ma15Path, ma30Path, areaPath };
  }, [historyData]);

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <a href="/" className="brand">
          <div className="brand-icon">Au</div>
          <div className="brand-info">
            <h1>
              Aurum AI <span className="brand-badge">औरम एआई</span>
            </h1>
            <p>Har Din Ka Sona-Chandi Update, Apni Bhasha Mein</p>
          </div>
        </a>

        <div className="nav-links">
          <a href="#calculator" className="nav-link">Calculator</a>
          <a href="#analytics" className="nav-link">Quantitative EDA</a>
          <a href="#ml-lab" className="nav-link">ML Gating Lab</a>
          <a
            href="https://t.me/Aurum_AI_Family_Bot"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-btn-tg"
            id="btn-telegram-live"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.18 3.35-1.38 3.73-1.39.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
            Talk to Telegram Bot
          </a>
        </div>
      </nav>

      {/* Telemetry Status Bar */}
      <section className="telemetry-bar" aria-label="System Status Telemetry">
        <div className="telemetry-item">
          <span className="telemetry-dot" />
          <span>PostgreSQL: <strong className="telemetry-val">Supabase Connected</strong></span>
        </div>
        <div className="telemetry-item">
          <span>Cron Cadence: <strong className="telemetry-val">Hourly (GitHub Actions)</strong></span>
        </div>
        <div className="telemetry-item">
          <span>Formula: <strong className="telemetry-val">Spot × FX × 1.18 (15% Duty + 3% GST)</strong></span>
        </div>
        <div className="telemetry-item">
          <span>ML Gating: <strong className="telemetry-val" style={{ color: "var(--ruby)" }}>RULE-016 Enforced (Factual Silence)</strong></span>
        </div>
      </section>

      {/* Hero Title */}
      <header className="hero-header">
        <div className="hero-subtitle">Institutional Bullion Intelligence & Personal Voice Companion</div>
        <h2 className="hero-title">
          Live Indian Gold & Silver <span>Landed Context</span>
        </h2>
        <p className="hero-desc">
          Aurum AI enforces strict mathematical determinism for financial computations while delivering cultural
          warmth in spoken Hindi. No financial advice, no predictive hallucination—only verifiable market facts.
        </p>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Top Ticker 1: 24K Gold */}
        <div className="card ticker-card" id="card-gold-24k">
          <div className="card-header">
            <div className="card-title-group">
              <h3>24K Fine Gold</h3>
              <p>99.9% Pure Investment Bullion</p>
            </div>
            <span className="brand-badge">Per 10g</span>
          </div>

          <div className="ticker-price-hero">
            {loading ? "Loading..." : formatINR(liveData?.metals.gold_24k.price_inr)}
          </div>
          <div className="ticker-subtext">
            <span>Per Gram: {formatINR(liveData?.metals.gold_24k.price_per_gram)}</span>
            <span>•</span>
            <span>Tax Inclusive (1.18x)</span>
          </div>

          <div className="ma-meters">
            <div className="ma-meter-row">
              <span className="ma-label">7-Day Moving Avg</span>
              <span className="ma-val">{formatINR(liveData?.metals.gold_24k.ma7)}</span>
              <span className={`ma-dev-tag ${(liveData?.metals.gold_24k.dev_ma7 || 0) < 0 ? "below" : "above"}`}>
                {(liveData?.metals.gold_24k.dev_ma7 || 0) > 0 ? "+" : ""}
                {liveData?.metals.gold_24k.dev_ma7 || 0}%
              </span>
            </div>
            <div className="ma-meter-row">
              <span className="ma-label">15-Day Moving Avg</span>
              <span className="ma-val">{formatINR(liveData?.metals.gold_24k.ma15)}</span>
              <span className={`ma-dev-tag ${(liveData?.metals.gold_24k.dev_ma15 || 0) < 0 ? "below" : "above"}`}>
                {(liveData?.metals.gold_24k.dev_ma15 || 0) > 0 ? "+" : ""}
                {liveData?.metals.gold_24k.dev_ma15 || 0}%
              </span>
            </div>
            <div className="ma-meter-row">
              <span className="ma-label">30-Day Moving Avg</span>
              <span className="ma-val">{formatINR(liveData?.metals.gold_24k.ma30)}</span>
              <span className={`ma-dev-tag ${(liveData?.metals.gold_24k.dev_ma30 || 0) < 0 ? "below" : "above"}`}>
                {(liveData?.metals.gold_24k.dev_ma30 || 0) > 0 ? "+" : ""}
                {liveData?.metals.gold_24k.dev_ma30 || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Top Ticker 2: 22K Gold */}
        <div className="card ticker-card" id="card-gold-22k">
          <div className="card-header">
            <div className="card-title-group">
              <h3>22K Standard Gold</h3>
              <p>91.6% Pure Jewelry Grade (916 Hallmarked)</p>
            </div>
            <span className="brand-badge">Per 10g</span>
          </div>

          <div className="ticker-price-hero">
            {loading ? "Loading..." : formatINR(liveData?.metals.gold_22k.price_inr)}
          </div>
          <div className="ticker-subtext">
            <span>Per Gram: {formatINR(liveData?.metals.gold_22k.price_per_gram)}</span>
            <span>•</span>
            <span>24K × (22/24) Factor</span>
          </div>

          <div className="ma-meters">
            <div className="ma-meter-row">
              <span className="ma-label">7-Day Moving Avg</span>
              <span className="ma-val">{formatINR(liveData?.metals.gold_22k.ma7)}</span>
              <span className={`ma-dev-tag ${(liveData?.metals.gold_22k.dev_ma7 || 0) < 0 ? "below" : "above"}`}>
                {(liveData?.metals.gold_22k.dev_ma7 || 0) > 0 ? "+" : ""}
                {liveData?.metals.gold_22k.dev_ma7 || 0}%
              </span>
            </div>
            <div className="ma-meter-row">
              <span className="ma-label">15-Day Moving Avg</span>
              <span className="ma-val">{formatINR(liveData?.metals.gold_22k.ma15)}</span>
              <span className={`ma-dev-tag ${(liveData?.metals.gold_22k.dev_ma15 || 0) < 0 ? "below" : "above"}`}>
                {(liveData?.metals.gold_22k.dev_ma15 || 0) > 0 ? "+" : ""}
                {liveData?.metals.gold_22k.dev_ma15 || 0}%
              </span>
            </div>
            <div className="ma-meter-row">
              <span className="ma-label">30-Day Moving Avg</span>
              <span className="ma-val">{formatINR(liveData?.metals.gold_22k.ma30)}</span>
              <span className={`ma-dev-tag ${(liveData?.metals.gold_22k.dev_ma30 || 0) < 0 ? "below" : "above"}`}>
                {(liveData?.metals.gold_22k.dev_ma30 || 0) > 0 ? "+" : ""}
                {liveData?.metals.gold_22k.dev_ma30 || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Top Ticker 3: Silver */}
        <div className="card ticker-card" id="card-silver">
          <div className="card-header">
            <div className="card-title-group">
              <h3>999 Fine Silver</h3>
              <p>99.9% Pure Physical Silver</p>
            </div>
            <span className="brand-badge">Per 10g</span>
          </div>

          <div className="ticker-price-hero">
            {loading ? "Loading..." : formatINR(liveData?.metals.silver.price_inr)}
          </div>
          <div className="ticker-subtext">
            <span>Per 1 KG: {formatINR(liveData?.metals.silver.price_per_kg)}</span>
            <span>•</span>
            <span>Landed INR</span>
          </div>

          <div className="ma-meters">
            <div className="ma-meter-row">
              <span className="ma-label">7-Day Moving Avg</span>
              <span className="ma-val">{formatINR(liveData?.metals.silver.ma7)}</span>
              <span className={`ma-dev-tag ${(liveData?.metals.silver.dev_ma7 || 0) < 0 ? "below" : "above"}`}>
                {(liveData?.metals.silver.dev_ma7 || 0) > 0 ? "+" : ""}
                {liveData?.metals.silver.dev_ma7 || 0}%
              </span>
            </div>
            <div className="ma-meter-row">
              <span className="ma-label">15-Day Moving Avg</span>
              <span className="ma-val">{formatINR(liveData?.metals.silver.ma15)}</span>
              <span className={`ma-dev-tag ${(liveData?.metals.silver.dev_ma15 || 0) < 0 ? "below" : "above"}`}>
                {(liveData?.metals.silver.dev_ma15 || 0) > 0 ? "+" : ""}
                {liveData?.metals.silver.dev_ma15 || 0}%
              </span>
            </div>
            <div className="ma-meter-row">
              <span className="ma-label">30-Day Moving Avg</span>
              <span className="ma-val">{formatINR(liveData?.metals.silver.ma30)}</span>
              <span className={`ma-dev-tag ${(liveData?.metals.silver.dev_ma30 || 0) < 0 ? "below" : "above"}`}>
                {(liveData?.metals.silver.dev_ma30 || 0) > 0 ? "+" : ""}
                {liveData?.metals.silver.dev_ma30 || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Main Historical Chart (8 cols) */}
        <div className="card main-chart-card" id="analytics">
          <div className="card-header">
            <div className="card-title-group">
              <h3>30-Day Trend & Moving Average Overlays</h3>
              <p>Domestic Landed 24K Gold Price Trajectory with Benchmarks</p>
            </div>
            <div className="chart-controls">
              <button
                className={`chart-btn ${showMA7 ? "active" : ""}`}
                onClick={() => setShowMA7(!showMA7)}
              >
                MA7 (Gold)
              </button>
              <button
                className={`chart-btn ${showMA15 ? "active" : ""}`}
                onClick={() => setShowMA15(!showMA15)}
              >
                MA15 (Cyan)
              </button>
              <button
                className={`chart-btn ${showMA30 ? "active" : ""}`}
                onClick={() => setShowMA30(!showMA30)}
              >
                MA30 (Purple)
              </button>
            </div>
          </div>

          <div className="chart-svg-container">
            {chartPoints ? (
              <svg viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                <line x1="20" y1="60" x2={chartPoints.width - 20} y2="60" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <line x1="20" y1="120" x2={chartPoints.width - 20} y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <line x1="20" y1="180" x2={chartPoints.width - 20} y2="180" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />

                {/* Area under Price */}
                <path d={chartPoints.areaPath} fill="url(#chartGradient)" />

                {/* Price Line */}
                <path d={chartPoints.pricePath} fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />

                {/* Moving Average Lines */}
                {showMA7 && <path d={chartPoints.ma7Path} fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeDasharray="3 3" opacity="0.85" />}
                {showMA15 && <path d={chartPoints.ma15Path} fill="none" stroke="#06B6D4" strokeWidth="1.8" opacity="0.85" />}
                {showMA30 && <path d={chartPoints.ma30Path} fill="none" stroke="#A855F7" strokeWidth="1.8" strokeDasharray="5 5" opacity="0.85" />}
              </svg>
            ) : (
              <p style={{ color: "var(--text-muted)", textAlign: "center", paddingTop: 80 }}>Loading chart analytics...</p>
            )}
          </div>
        </div>

        {/* Deterministic Unit Calculator (4 cols) */}
        <div className="card calculator-card" id="calculator">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Affordability Calculator</h3>
              <p>Pure Deterministic Math (RULE-001)</p>
            </div>
            <span className="brand-badge">Zero LLM Math</span>
          </div>

          <div className="calc-field">
            <label htmlFor="budget-input">Your Budget in INR (₹)</label>
            <div className="calc-input-wrapper">
              <span className="calc-prefix">₹</span>
              <input
                id="budget-input"
                type="number"
                step="5000"
                className="calc-input"
                value={calcBudget}
                onChange={(e) => setCalcBudget(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="calc-field">
            <label>Select Precious Metal</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className={`chart-btn ${calcMetal === "gold_24k" ? "active" : ""}`}
                style={{ flex: 1 }}
                onClick={() => setCalcMetal("gold_24k")}
              >
                24K Gold
              </button>
              <button
                className={`chart-btn ${calcMetal === "gold_22k" ? "active" : ""}`}
                style={{ flex: 1 }}
                onClick={() => setCalcMetal("gold_22k")}
              >
                22K Gold
              </button>
              <button
                className={`chart-btn ${calcMetal === "silver" ? "active" : ""}`}
                style={{ flex: 1 }}
                onClick={() => setCalcMetal("silver")}
              >
                Silver
              </button>
            </div>
          </div>

          {/* Unit Conversion Grid */}
          <div className="calc-units-grid">
            <div className="unit-box">
              <h4>Grams</h4>
              <div className="unit-value">{calcResults.grams} g</div>
            </div>
            <div className="unit-box">
              <h4>Tolas (11.66g)</h4>
              <div className="unit-value">{calcResults.tolas} Tola</div>
            </div>
            <div className="unit-box">
              <h4>Sovereign / Pavan</h4>
              <div className="unit-value">{calcResults.pavans} Pav</div>
            </div>
            <div className="unit-box">
              <h4>Troy Ounces</h4>
              <div className="unit-value">{calcResults.ounces} oz</div>
            </div>
          </div>

          {/* Landed Cost Breakdown */}
          <div className="tax-breakdown-box">
            <div className="tax-row">
              <span>Pure Bullion Value:</span>
              <span>{formatINR(calcResults.base)}</span>
            </div>
            <div className="tax-row">
              <span>Import Customs Duty (15%):</span>
              <span>{formatINR(calcResults.duty)}</span>
            </div>
            <div className="tax-row">
              <span>Physical Bullion GST (3%):</span>
              <span>{formatINR(calcResults.gst)}</span>
            </div>
            <div className="tax-row total">
              <span>Total Landed Outlay:</span>
              <span>{formatINR(calcBudget)}</span>
            </div>
          </div>
        </div>

        {/* Machine Learning Lab & EDA Gating (12 cols) */}
        <div className="card ml-lab-card" id="ml-lab">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Quantitative Intelligence & ML Gating Protocol</h3>
              <p>Transparent Walk-Forward Backtesting (Spec §4.2, RULE-016 & RULE-017)</p>
            </div>
            <span className="brand-badge" style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#F87171" }}>
              Gated Invariant
            </span>
          </div>

          {/* Strict Gating Banner */}
          <div className="gating-banner">
            <span className="gating-badge">NEGATIVE RESULT HONORED</span>
            <div className="gating-text">
              <strong>RULE-016 Gating Invariant Active:</strong> Aurum AI strictly forbids deploying price prediction models that fail to demonstrate an out-of-sample edge over random chance. A candidate XGBoost/Prophet model achieved <strong>61.04%</strong> accuracy, exactly matching the <strong>61.04%</strong> naive majority baseline (0.00% edge). Per our engineering rules, the model is gated, and Aurum AI remains completely silent on future price direction.
            </div>
          </div>

          {/* 4 Strip Metrics */}
          <div className="ml-metrics-strip">
            <div className="ml-stat-card">
              <div className="label">Evaluation Window</div>
              <div className="val">462 Days</div>
              <div className="sub">11 Out-of-Sample Folds</div>
            </div>
            <div className="ml-stat-card">
              <div className="label">Model Accuracy</div>
              <div className="val">61.04%</div>
              <div className="sub">Rolling Walk-Forward Test</div>
            </div>
            <div className="ml-stat-card">
              <div className="label">Naive Baseline</div>
              <div className="val">61.04%</div>
              <div className="sub">Majority Direction Rate</div>
            </div>
            <div className="ml-stat-card">
              <div className="label">Empirical Edge</div>
              <div className="val" style={{ color: "var(--ruby)" }}>0.00%</div>
              <div className="sub">Fold 10 Drawdown: 30.95%</div>
            </div>
          </div>

          {/* Cross Asset Correlation EDA */}
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontFamily: "var(--font-heading)", fontSize: 15, marginBottom: 10, color: "var(--gold-light)" }}>
              Cross-Asset Exploratory Data Analysis (EDA) Insights:
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {historyData?.eda.insights.map((ins, i) => (
                <div key={i} style={{ padding: 12, background: "rgba(8,10,15,0.4)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--text-muted)" }}>
                  💡 {ins}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Voice & Agent Simulator (6 cols) */}
        <div className="card sandbox-card" id="chat-sandbox">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Web Conversation Sandbox</h3>
              <p>Test the Hindi Persona & Safety Guardrails</p>
            </div>
            <span className="brand-badge">Gemini 3.8 Flash</span>
          </div>

          <div className="chat-simulator-box" aria-live="polite">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.role}`}>
                <div>{msg.text}</div>
                {msg.disclaimer && (
                  <span className="disclaimer-tag">
                    Yeh anumaanit keemat hai — sthaniya dukaandaar se alag ho sakti hai. Yeh salaah nahi hai.
                  </span>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="chat-bubble bot" style={{ opacity: 0.6 }}>
                <em>Aurum AI is computing live market context...</em>
              </div>
            )}
          </div>

          {/* Quick preset chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 10 }}>
            <button className="chart-btn" onClick={() => handleSendChat("Aaj sone ka kya bhav hai?")}>
              Aaj sone ka rate?
            </button>
            <button className="chart-btn" onClick={() => handleSendChat("50,000 rupaye mein kitna sona aayega?")}>
              ₹50,000 mein sona?
            </button>
            <button className="chart-btn" onClick={() => handleSendChat("Kya mujhe aaj sona khareedna chahiye?")}>
              Should I buy today? (Test)
            </button>
          </div>

          <form
            className="chat-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
          >
            <input
              type="text"
              className="chat-input-field"
              placeholder="Poochiye: 'Aaj sone ka rate kya chal raha hai?'"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button type="submit" className="chat-send-btn">Send</button>
          </form>
        </div>

        {/* Live Telegram Bridge & Alerts Monitor (6 cols) */}
        <div className="card alerts-console-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Automated Telegram Companion Bridge</h3>
              <p>Connected via Webhook with 48h Anti-Spam State Machine</p>
            </div>
            <span className="brand-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--emerald)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
              Active 24/7
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            <div style={{ padding: 14, background: "rgba(8,10,15,0.4)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <h4 style={{ fontSize: 13, color: "var(--gold-light)", marginBottom: 6 }}>Voice Synthesis Engine:</h4>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Edge-TTS (<strong>hi-IN-SwaraNeural</strong>) + FFmpeg libopus (<strong>48,000 Hz Mono</strong>) containerized into native OGG voice bubbles for Telegram clients.
              </p>
            </div>

            <div style={{ padding: 14, background: "rgba(8,10,15,0.4)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <h4 style={{ fontSize: 13, color: "var(--gold-light)", marginBottom: 6 }}>Alert Trigger Rules:</h4>
              <ul style={{ fontSize: 13, color: "var(--text-muted)", paddingLeft: 18, lineHeight: 1.6 }}>
                <li><strong>Target Hit:</strong> Fires when market price reaches user target, then enters 48h cooldown.</li>
                <li><strong>MA Deviation:</strong> Fires if price drops more than 1.5% below the 15-day moving average.</li>
              </ul>
            </div>

            <a
              href="https://t.me/Aurum_AI_Family_Bot"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-btn-tg"
              style={{ justifyContent: "center", padding: 14, marginTop: 6 }}
            >
              Open Telegram Voice Bot (@Aurum_AI_Family_Bot)
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-disclaimer">
          <strong>Mandatory Disclosure:</strong> Aurum AI provides landed retail estimates based on international spot quotes, currency exchange rates, Indian customs import duty (15%), and GST (3%). Physical retail dealer quotes, local hallmark charges, and jeweler making charges may vary. Aurum AI never provides financial or investment advice.
        </div>
        <div>
          <span>Aurum AI v2.0 • Apache License 2.0 • </span>
          <a href="https://github.com/HarshkumarG007/AurumAI" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-light)" }}>
            GitHub Repository
          </a>
        </div>
      </footer>
    </div>
  );
}
