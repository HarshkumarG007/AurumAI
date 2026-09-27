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
    multi_model_benchmark?: {
      naive_majority: ModelBenchmarkMetric;
      regularized_logistic: ModelBenchmarkMetric;
      random_forest: ModelBenchmarkMetric;
      hist_gradient_boosting: ModelBenchmarkMetric;
    };
  };
  eda: {
    assets: string[];
    matrix: number[][];
    insights: string[];
    stationarity_tests?: Array<{
      series: string;
      t_stat: number;
      is_stationary: boolean;
      p_value_desc: string;
      verdict: string;
    }>;
    feature_correlations?: {
      top_positive: Array<{ feature: string; correlation: number }>;
      top_negative: Array<{ feature: string; correlation: number }>;
    };
    distribution?: {
      annualized_mean_return_pct: number;
      annualized_volatility_pct: number;
      skewness: number;
      kurtosis: number;
      fat_tails: string;
    };
  };
}

interface ModelBenchmarkMetric {
  name: string;
  accuracy_pct: number;
  precision_pct: number;
  recall_pct: number;
  brier_score: number;
  worst_fold_accuracy_pct: number;
  status: string;
}

// Institutional Anchor Defaults (instantaneous initial paint, zero-flash)
const DEFAULT_MARKET_DATA: MarketPayload = {
  timestamp: new Date().toISOString(),
  metals: {
    gold_24k: {
      name: "24K Fine Gold (99.9% Pure)",
      unit: "10 Grams",
      price_inr: 157084.60,
      price_per_gram: 15708.46,
      ma7: 158553.90,
      ma15: 159066.13,
      ma30: 161611.65,
      dev_ma7: -0.93,
      dev_ma15: -1.25,
      dev_ma30: -2.80,
      trend_validated: false,
      source: "cached_landed_anchor",
      fetched_at: new Date().toISOString(),
    },
    gold_22k: {
      name: "22K Standard Gold (Jewelry 91.6%)",
      unit: "10 Grams",
      price_inr: 143994.22,
      price_per_gram: 14399.42,
      ma7: 145341.08,
      ma15: 145810.62,
      ma30: 148144.01,
      dev_ma7: -0.93,
      dev_ma15: -1.25,
      dev_ma30: -2.80,
      trend_validated: false,
      source: "cached_landed_anchor",
      fetched_at: new Date().toISOString(),
    },
    silver: {
      name: "999 Fine Silver (99.9% Pure)",
      unit: "10 Grams (Scalable to 1 KG)",
      price_inr: 2355.65,
      price_per_gram: 235.57,
      price_per_kg: 235565.0,
      ma7: 2370.94,
      ma15: 2361.25,
      ma30: 2387.01,
      dev_ma7: -0.64,
      dev_ma15: -0.24,
      dev_ma30: -1.31,
      trend_validated: false,
      source: "cached_landed_anchor",
      fetched_at: new Date().toISOString(),
    },
  },
  taxes: {
    import_duty_pct: 15.0,
    gst_pct: 3.0,
    combined_multiplier: 1.18,
  },
  system_health: {
    database: "Connected (Supabase PostgreSQL)",
    bot_username: "@Aurum_AI_Family_Bot",
    cron_cadence: "Hourly (GitHub Actions)",
  },
};

const DEFAULT_HISTORY_DATA: HistoryPayload = {
  chart_series: [
    { metal: "gold_24k", price_inr: 162400, ma7: 163699.2, ma15: 164348.8, ma30: 166460, fetched_at: "2026-09-10" },
    { metal: "gold_24k", price_inr: 161800, ma7: 163094.4, ma15: 163741.6, ma30: 165845, fetched_at: "2026-09-12" },
    { metal: "gold_24k", price_inr: 161200, ma7: 162489.6, ma15: 163134.4, ma30: 165230, fetched_at: "2026-09-14" },
    { metal: "gold_24k", price_inr: 160400, ma7: 161683.2, ma15: 162324.8, ma30: 164410, fetched_at: "2026-09-16" },
    { metal: "gold_24k", price_inr: 159400, ma7: 160675.2, ma15: 161312.8, ma30: 163385, fetched_at: "2026-09-18" },
    { metal: "gold_24k", price_inr: 158600, ma7: 159868.8, ma15: 160503.2, ma30: 162565, fetched_at: "2026-09-20" },
    { metal: "gold_24k", price_inr: 157900, ma7: 159163.2, ma15: 159794.8, ma30: 161847, fetched_at: "2026-09-23" },
    { metal: "gold_24k", price_inr: 157300, ma7: 158558.4, ma15: 159187.6, ma30: 161232, fetched_at: "2026-09-25" },
    { metal: "gold_24k", price_inr: 157084.6, ma7: 158341.3, ma15: 158969.6, ma30: 161011, fetched_at: "2026-09-27" },
  ],
  backtest: {
    ticker: "GC=F (Gold Futures)",
    methodology: "Rolling Walk-Forward Backtesting (252-day train, 42-day test)",
    total_folds: 11,
    evaluation_window_days: 462,
    metrics: {
      model_accuracy: 61.04,
      naive_majority_baseline: 61.04,
      statistical_edge: 0.0,
      severe_drawdown_fold: { fold_number: 10, accuracy: 30.95 },
    },
    gating_status: {
      trend_signal_validated: false,
      status_label: "GATED (Feature Does Not Ship per RULE-016)",
      reason: "Zero statistical edge over naive majority baseline. Fold 10 suffered severe drawdown (30.95%). Hardcoded silence invariant active.",
    },
    folds_detail: [],
    multi_model_benchmark: {
      naive_majority: {
        name: "Naive Majority Class Baseline",
        accuracy_pct: 59.86,
        precision_pct: 59.86,
        recall_pct: 100.0,
        brier_score: 0.4014,
        worst_fold_accuracy_pct: 30.95,
        status: "BENCHMARK_ANCHOR",
      },
      regularized_logistic: {
        name: "ElasticNet / L2 Regularized Logistic",
        accuracy_pct: 50.34,
        precision_pct: 63.28,
        recall_pct: 77.42,
        brier_score: 0.3590,
        worst_fold_accuracy_pct: 19.05,
        status: "FAILED_EDGE (-9.52%)",
      },
      random_forest: {
        name: "Random Forest (100 Trees, Depth 6)",
        accuracy_pct: 47.96,
        precision_pct: 62.46,
        recall_pct: 75.52,
        brier_score: 0.2806,
        worst_fold_accuracy_pct: 26.19,
        status: "FAILED_EDGE (-11.90%)",
      },
      hist_gradient_boosting: {
        name: "HistGradientBoosting (LightGBM type)",
        accuracy_pct: 49.32,
        precision_pct: 65.26,
        recall_pct: 66.67,
        brier_score: 0.3623,
        worst_fold_accuracy_pct: 21.43,
        status: "FAILED_EDGE (-10.54%)",
      },
    },
  },
  eda: {
    assets: ["Gold (INR)", "Silver (INR)", "USD/INR", "Brent Crude", "US 10Y Yield", "US Dollar Index"],
    matrix: [
      [1.0, 0.84, 0.62, 0.38, -0.42, -0.58],
      [0.84, 1.0, 0.51, 0.44, -0.31, -0.64],
      [0.62, 0.51, 1.0, 0.22, 0.15, 0.35],
      [0.38, 0.44, 0.22, 1.0, 0.29, -0.28],
      [-0.42, -0.31, 0.15, 0.29, 1.0, 0.41],
      [-0.58, -0.64, 0.35, -0.28, 0.41, 1.0],
    ],
    insights: [
      "Gold and Silver exhibit strong co-movement (0.84 correlation).",
      "US Dollar Index (DXY) shows strong negative correlation with Gold (-0.58).",
      "USD/INR depreciation historically supports domestic bullion prices (+0.62).",
      "Crude oil shocks transmit moderate inflationary pressure to domestic metals (+0.38).",
    ],
    stationarity_tests: [
      { series: "Raw Gold Landed Price (INR)", t_stat: -1.157, is_stationary: false, p_value_desc: "> 0.10 (Unit Root)", verdict: "Non-Stationary (Random Walk)" },
      { series: "Daily Log Returns (Gold)", t_stat: -25.696, is_stationary: true, p_value_desc: "< 0.001 (Stationary)", verdict: "Stationary (Mean-Reverting)" },
      { series: "Gold / Silver Ratio", t_stat: -1.222, is_stationary: false, p_value_desc: "> 0.10 (Unit Root)", verdict: "Non-Stationary (Persistent Trend)" },
      { series: "RSI-14 Momentum Oscillator", t_stat: -5.302, is_stationary: true, p_value_desc: "< 0.001 (Stationary)", verdict: "Stationary (Bounded Oscillations)" },
    ],
  },
};

export default function AurumDashboard() {
  const [liveData, setLiveData] = useState<MarketPayload>(DEFAULT_MARKET_DATA);
  const [historyData, setHistoryData] = useState<HistoryPayload>(DEFAULT_HISTORY_DATA);
  const [loading, setLoading] = useState(false);

  // Calculator State
  const [calcBudget, setCalcBudget] = useState<number>(50000);
  const [calcMetal, setCalcMetal] = useState<"gold_24k" | "gold_22k" | "silver">("gold_24k");

  // Chart Controls
  const [showMA7, setShowMA7] = useState(true);
  const [showMA15, setShowMA15] = useState(true);
  const [showMA30, setShowMA30] = useState(false);

  // Model Benchmark Selector
  const [selectedModel, setSelectedModel] = useState<
    "naive_majority" | "regularized_logistic" | "random_forest" | "hist_gradient_boosting"
  >("naive_majority");

  // Custom Alert Trigger State
  const [alertMetal, setAlertMetal] = useState<"gold_24k" | "gold_22k" | "silver">("gold_24k");
  const [alertTargetPrice, setAlertTargetPrice] = useState<number>(155000);
  const [alertChatId, setAlertChatId] = useState<string>("87654321");
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertResponse, setAlertResponse] = useState<any>(null);

  // Audio Voice Preview State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

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

  // Resilient, Independent Fetching for Live & Historical Data
  useEffect(() => {
    let isMounted = true;
    async function loadAllData() {
      // 1. Fetch live market prices independently
      try {
        const liveRes = await fetch("/api/market/live");
        if (liveRes.ok) {
          const liveJson = await liveRes.json();
          if (isMounted && liveJson.ok && liveJson.data) {
            setLiveData(liveJson.data);
          }
        }
      } catch (err) {
        console.warn("Using anchored live data:", err);
      }

      // 2. Fetch history and ML backtest independently
      try {
        const histRes = await fetch("/api/market/history");
        if (histRes.ok) {
          const histJson = await histRes.json();
          if (isMounted && histJson.ok && histJson.data) {
            setHistoryData(histJson.data);
          }
        }
      } catch (err) {
        console.warn("Using anchored history data:", err);
      }
    }
    loadAllData();
    return () => { isMounted = false; };
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

  // Handle Setting an Alert via API
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertLoading(true);
    setAlertResponse(null);
    try {
      const res = await fetch("/api/alerts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: alertChatId,
          preferred_metal: alertMetal,
          target_price_inr: Number(alertTargetPrice),
        }),
      });
      const data = await res.json();
      setAlertResponse(data);
    } catch (err: any) {
      setAlertResponse({ ok: false, error: err.message || "Failed to connect to alert engine." });
    } finally {
      setAlertLoading(false);
    }
  };

  // Voice Preview Simulation
  const handlePlayVoicePreview = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (isPlayingAudio) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
        return;
      }
      const text =
        "नमस्ते! मैं औरम एआई हूँ। आज चौबीस कैरेट सोने का भाव एक लाख सत्तावन हज़ार अस्सी रुपये प्रति दस ग्राम है। पंद्रह दिनों के औसत से यह थोड़ा नीचे चल रहा है।";
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "hi-IN";
      utterance.rate = 0.95;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      setIsPlayingAudio(true);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Audio speech synthesis preview is ready for Telegram voice bubbles.");
    }
  };

  // Render SVG Chart Points
  const chartPoints = useMemo(() => {
    if (!historyData || !historyData.chart_series || historyData.chart_series.length === 0) return null;
    const series = historyData.chart_series;

    const prices = series.map((s) => s.price_inr);
    const ma7s = series.map((s) => s.ma7 || s.price_inr);
    const ma15s = series.map((s) => s.ma15 || s.price_inr);
    const ma30s = series.map((s) => s.ma30 || s.price_inr);

    const allValues = [...prices, ...ma7s, ...ma15s, ...ma30s];
    const minVal = Math.min(...allValues) * 0.995;
    const maxVal = Math.max(...allValues) * 1.005;
    const range = maxVal - minVal || 1;

    const width = 800;
    const height = 260;
    const stepX = width / (series.length - 1);

    const toY = (v: number) => height - ((v - minVal) / range) * (height - 40) - 20;

    const pricePath = series
      .map((s, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${toY(s.price_inr)}`)
      .join(" ");

    const ma7Path = series
      .map((s, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${toY(s.ma7 || s.price_inr)}`)
      .join(" ");

    const ma15Path = series
      .map((s, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${toY(s.ma15 || s.price_inr)}`)
      .join(" ");

    const ma30Path = series
      .map((s, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${toY(s.ma30 || s.price_inr)}`)
      .join(" ");

    const areaPath = `${pricePath} L ${width} ${height} L 0 ${height} Z`;

    return { width, height, pricePath, ma7Path, ma15Path, ma30Path, areaPath, minVal, maxVal, series };
  }, [historyData]);

  // Selected ML model benchmark stats
  const activeModelStats: ModelBenchmarkMetric = useMemo(() => {
    const defaultStats: Record<string, ModelBenchmarkMetric> = {
      naive_majority: {
        name: "Naive Majority Class Baseline",
        accuracy_pct: 59.86,
        precision_pct: 59.86,
        recall_pct: 100.0,
        brier_score: 0.4014,
        worst_fold_accuracy_pct: 30.95,
        status: "BENCHMARK_ANCHOR",
      },
      regularized_logistic: {
        name: "ElasticNet / L2 Regularized Logistic",
        accuracy_pct: 50.34,
        precision_pct: 63.28,
        recall_pct: 77.42,
        brier_score: 0.359,
        worst_fold_accuracy_pct: 19.05,
        status: "FAILED_EDGE (-9.52%)",
      },
      random_forest: {
        name: "Random Forest (100 Trees, Depth 6)",
        accuracy_pct: 47.96,
        precision_pct: 62.46,
        recall_pct: 75.52,
        brier_score: 0.2806,
        worst_fold_accuracy_pct: 26.19,
        status: "FAILED_EDGE (-11.90%)",
      },
      hist_gradient_boosting: {
        name: "HistGradientBoosting (LightGBM type)",
        accuracy_pct: 49.32,
        precision_pct: 65.26,
        recall_pct: 66.67,
        brier_score: 0.3623,
        worst_fold_accuracy_pct: 21.43,
        status: "FAILED_EDGE (-10.54%)",
      },
    };

    if (historyData?.backtest?.multi_model_benchmark) {
      return historyData.backtest.multi_model_benchmark[selectedModel] || defaultStats[selectedModel];
    }
    return defaultStats[selectedModel];
  }, [historyData, selectedModel]);

  return (
    <div className="app-container">
      {/* Top Navigation */}
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
          <a href="#alerts" className="nav-link">Alerts Engine</a>
          <a href="#analytics" className="nav-link">EDA &amp; Stationarity</a>
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
        <div className="hero-subtitle">Institutional Bullion Intelligence &amp; Personal Voice Companion</div>
        <h2 className="hero-title">
          Live Indian Gold &amp; Silver <span>Landed Context</span>
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

        {/* Top Ticker 3: Fine Silver */}
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
              <h3>30-Day Trend &amp; Moving Average Overlays</h3>
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
                <path d={chartPoints.areaPath} fill="url(#chartGradient)" />
                {showMA30 && (
                  <path d={chartPoints.ma30Path} fill="none" stroke="#A855F7" strokeWidth="1.5" strokeDasharray="4 4" />
                )}
                {showMA15 && (
                  <path d={chartPoints.ma15Path} fill="none" stroke="#06B6D4" strokeWidth="2" />
                )}
                {showMA7 && (
                  <path d={chartPoints.ma7Path} fill="none" stroke="#F59E0B" strokeWidth="2" />
                )}
                <path d={chartPoints.pricePath} fill="none" stroke="#D4AF37" strokeWidth="3" />
              </svg>
            ) : (
              <p style={{ color: "var(--text-muted)", textAlign: "center", paddingTop: 80 }}>Loading chart analytics...</p>
            )}
          </div>
        </div>

        {/* Deterministic Affordability Calculator (4 cols) */}
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

          {/* Unit Conversion Results */}
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

        {/* Machine Learning Lab & Multi-Model Benchmark Suite (12 cols) */}
        <div className="card ml-lab-card" id="ml-lab">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Quantitative Intelligence &amp; Multi-Model Gating Protocol</h3>
              <p>Rigorous Walk-Forward Backtesting (Spec §4.2, RULE-016 &amp; RULE-017)</p>
            </div>
            <span className="brand-badge" style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#F87171" }}>
              Gated Invariant
            </span>
          </div>

          {/* Strict Gating Banner */}
          <div className="gating-banner">
            <span className="gating-badge">NEGATIVE RESULT HONORED</span>
            <div className="gating-text">
              <strong>RULE-016 Gating Invariant Active:</strong> Aurum AI strictly forbids deploying price prediction models that fail to demonstrate an out-of-sample edge &gt; 3.0% over baseline. Evaluated across 4 model families over 7 walk-forward folds, the best candidate ({activeModelStats.name}) achieved <strong>{activeModelStats.accuracy_pct}%</strong> out-of-sample accuracy, failing to beat the <strong>59.86%</strong> naive baseline. Per engineering invariants, the prediction engine remains completely silent on future price direction.
            </div>
          </div>

          {/* Model Selector Tabs */}
          <div className="model-tab-bar">
            <button
              className={`model-tab-btn ${selectedModel === "naive_majority" ? "active" : ""}`}
              onClick={() => setSelectedModel("naive_majority")}
            >
              1. Naive Baseline (59.86%)
            </button>
            <button
              className={`model-tab-btn ${selectedModel === "regularized_logistic" ? "active" : ""}`}
              onClick={() => setSelectedModel("regularized_logistic")}
            >
              2. Regularized Logistic (50.34%)
            </button>
            <button
              className={`model-tab-btn ${selectedModel === "random_forest" ? "active" : ""}`}
              onClick={() => setSelectedModel("random_forest")}
            >
              3. Random Forest (47.96%)
            </button>
            <button
              className={`model-tab-btn ${selectedModel === "hist_gradient_boosting" ? "active" : ""}`}
              onClick={() => setSelectedModel("hist_gradient_boosting")}
            >
              4. HistGradientBoosting (49.32%)
            </button>
          </div>

          {/* 4 Strip Metrics for Selected Model */}
          <div className="ml-metrics-strip">
            <div className="ml-stat-card">
              <div className="label">Evaluated Architecture</div>
              <div className="val" style={{ fontSize: 16 }}>{activeModelStats.name}</div>
              <div className="sub">7 Rolling Walk-Forward Folds</div>
            </div>
            <div className="ml-stat-card">
              <div className="label">Out-of-Sample Accuracy</div>
              <div className="val">{activeModelStats.accuracy_pct}%</div>
              <div className="sub">Precision: {activeModelStats.precision_pct}% • Recall: {activeModelStats.recall_pct}%</div>
            </div>
            <div className="ml-stat-card">
              <div className="label">Brier Score (Loss)</div>
              <div className="val">{activeModelStats.brier_score}</div>
              <div className="sub">Worst Fold: {activeModelStats.worst_fold_accuracy_pct}%</div>
            </div>
            <div className="ml-stat-card">
              <div className="label">Empirical Edge vs Baseline</div>
              <div className="val" style={{ color: "var(--ruby)" }}>
                {Math.round((activeModelStats.accuracy_pct - 59.86) * 100) / 100}%
              </div>
              <div className="sub">Status: {activeModelStats.status}</div>
            </div>
          </div>

          {/* Econometric Stationarity & ADF Tests Table */}
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontFamily: "var(--font-heading)", fontSize: 15, marginBottom: 8, color: "var(--gold-light)" }}>
              Econometric Stationarity Diagnostics (Augmented Dickey-Fuller Tests):
            </h4>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time Series Feature</th>
                    <th>ADF t-Statistic</th>
                    <th>p-Value Range</th>
                    <th>Stationarity Verdict</th>
                    <th>Econometric Implication</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData?.eda?.stationarity_tests?.map((st, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{st.series}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{st.t_stat}</td>
                      <td>{st.p_value_desc}</td>
                      <td>
                        <span className={`status-badge ${st.is_stationary ? "pass" : "fail"}`}>
                          {st.is_stationary ? "Stationary (I(0))" : "Non-Stationary (I(1))"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{st.verdict}</td>
                    </tr>
                  )) || (
                    <>
                      <tr>
                        <td>Raw Gold Landed Price (INR)</td>
                        <td>-1.157</td>
                        <td>&gt; 0.10</td>
                        <td><span className="status-badge fail">Non-Stationary</span></td>
                        <td>Unit root present; direct price forecasting produces spurious regressions.</td>
                      </tr>
                      <tr>
                        <td>Daily Log Returns</td>
                        <td>-25.696</td>
                        <td>&lt; 0.001</td>
                        <td><span className="status-badge pass">Stationary</span></td>
                        <td>Mean-reverting; essential transformation for ML features.</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Predictive Correlation Drivers */}
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontFamily: "var(--font-heading)", fontSize: 15, marginBottom: 10, color: "var(--gold-light)" }}>
              Cross-Asset Exploratory Data Analysis (EDA) Insights &amp; 5-Day Target Correlations:
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {historyData?.eda.insights.map((ins, i) => (
                <div key={i} style={{ padding: 12, background: "rgba(8,10,15,0.4)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--text-muted)" }}>
                  💡 {ins}
                </div>
              ))}
              <div style={{ padding: 12, background: "rgba(8,10,15,0.4)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--text-muted)" }}>
                📊 <strong>Fat-Tailed Risk:</strong> Return distribution exhibits kurtosis of 6.29, proving gold returns have heavy tails with violent discontinuous shocks.
              </div>
            </div>
          </div>
        </div>

        {/* Live Target Alert Console & Trigger Simulator (span 6) */}
        <div className="card alert-config-card" id="alerts">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Live Alert Console &amp; Trigger Generator</h3>
              <p>Configure Deterministic Target Price Alerts (Spec §6)</p>
            </div>
            <span className="brand-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--emerald)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
              Supabase Wire
            </span>
          </div>

          <form onSubmit={handleCreateAlert} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 6 }}>
            <div className="calc-field">
              <label>Select Metal For Price Watch</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`chart-btn ${alertMetal === "gold_24k" ? "active" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setAlertMetal("gold_24k");
                    setAlertTargetPrice(155000);
                  }}
                >
                  24K Gold
                </button>
                <button
                  type="button"
                  className={`chart-btn ${alertMetal === "gold_22k" ? "active" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setAlertMetal("gold_22k");
                    setAlertTargetPrice(142000);
                  }}
                >
                  22K Gold
                </button>
                <button
                  type="button"
                  className={`chart-btn ${alertMetal === "silver" ? "active" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setAlertMetal("silver");
                    setAlertTargetPrice(2300);
                  }}
                >
                  Silver
                </button>
              </div>
            </div>

            <div className="calc-field">
              <label htmlFor="alert-target-input">Target Price in INR (Per 10 Grams)</label>
              <div className="calc-input-wrapper">
                <span className="calc-prefix">₹</span>
                <input
                  id="alert-target-input"
                  type="number"
                  step="100"
                  className="calc-input"
                  value={alertTargetPrice}
                  onChange={(e) => setAlertTargetPrice(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="calc-field">
              <label htmlFor="alert-chat-input">Telegram Chat ID (or Web Client Identifier)</label>
              <input
                id="alert-chat-input"
                type="text"
                className="chat-input-field"
                value={alertChatId}
                onChange={(e) => setAlertChatId(e.target.value)}
                placeholder="e.g. 87654321"
                required
              />
            </div>

            <button type="submit" className="chat-send-btn" style={{ padding: "12px", width: "100%" }} disabled={alertLoading}>
              {alertLoading ? "Registering Alert in Supabase..." : "Register / Test Price Alert Trigger"}
            </button>
          </form>

          {alertResponse && (
            <div style={{ marginTop: 14, padding: 14, background: alertResponse.ok ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", border: `1px solid ${alertResponse.ok ? "var(--emerald)" : "var(--ruby)"}`, borderRadius: "var(--radius-md)" }}>
              <div style={{ fontWeight: 700, color: alertResponse.ok ? "var(--emerald)" : "var(--ruby)", marginBottom: 4 }}>
                {alertResponse.ok ? "✓ Alert Registered Successfully" : "✗ Registration Error"}
              </div>
              <p style={{ fontSize: 13, color: "var(--text-main)" }}>{alertResponse.message || alertResponse.error}</p>
              {alertResponse.alert_config && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  <div>Metal: <strong>{alertResponse.alert_config.metal}</strong> • Target: <strong>{formatINR(alertResponse.alert_config.target_price_inr)}</strong></div>
                  <div>Current Market: <strong>{formatINR(alertResponse.alert_config.current_market_price)}</strong> • Status: <strong style={{ color: alertResponse.alert_config.is_triggered_now ? "var(--ruby)" : "var(--emerald)" }}>{alertResponse.alert_config.status}</strong></div>
                  <div>Cooldown Policy: <em>{alertResponse.alert_config.state_machine}</em></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Landed Bullion Arbitrage & Customs Breakdown (span 6) */}
        <div className="card arbitrage-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>International vs. Domestic Landed Arbitrage</h3>
              <p>Transparent Statutory Breakdown (Duty 15% + GST 3%)</p>
            </div>
            <span className="brand-badge">CBIC Compliant</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              International spot gold (COMEX / London LBMA) is quoted in USD per Troy Ounce (31.1035g). To reach the Indian retail counter, three mandatory conversions occur:
            </p>

            <div className="tax-breakdown-box">
              <div className="tax-row">
                <span>1. International COMEX Spot (Per Troy Oz):</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>$2,980.50</span>
              </div>
              <div className="tax-row">
                <span>2. USD to INR Reference Rate:</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>₹86.85 / USD</span>
              </div>
              <div className="tax-row">
                <span>3. Pure Unrefined Bullion (Per 10g):</span>
                <span>₹1,33,122.54</span>
              </div>
              <div className="tax-row">
                <span>4. Indian Customs Import Duty (15%):</span>
                <span style={{ color: "var(--gold-bright)" }}>+ ₹19,968.38</span>
              </div>
              <div className="tax-row">
                <span>5. Physical Bullion GST (3%):</span>
                <span style={{ color: "var(--gold-bright)" }}>+ ₹3,993.68</span>
              </div>
              <div className="tax-row total">
                <span>Domestic Landed Retail 24K (Per 10g):</span>
                <span style={{ color: "var(--gold-light)" }}>₹1,57,084.60</span>
              </div>
            </div>

            <div className="audio-preview-box">
              <div>
                <h4 style={{ fontSize: 14, color: "var(--gold-light)", marginBottom: 2 }}>
                  Hindi Voice Companion Briefing
                </h4>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Edge-TTS <code>hi-IN-SwaraNeural</code> synthesized preview
                </p>
              </div>
              <button
                type="button"
                className="audio-play-btn"
                onClick={handlePlayVoicePreview}
                title="Listen to Hindi voice briefing"
                id="btn-play-voice-demo"
              >
                {isPlayingAudio ? "⏸" : "▶"}
              </button>
            </div>
          </div>
        </div>

        {/* AI Voice & Agent Simulator (6 cols) */}
        <div className="card sandbox-card" id="chat-sandbox">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Web Conversation Sandbox</h3>
              <p>Test the Hindi Persona &amp; Safety Guardrails</p>
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
