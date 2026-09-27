"use client";

import React, { useState } from "react";

interface JournalManuscriptProps {
  onClose?: () => void;
  isModal?: boolean;
}

export default function JournalManuscript({ onClose, isModal = false }: JournalManuscriptProps) {
  const [activeChapter, setActiveChapter] = useState<string>("prologue");
  const [fontSize, setFontSize] = useState<"standard" | "large">("standard");

  const scrollToSection = (id: string) => {
    setActiveChapter(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <article className={`vintage-parchment-wrapper ${isModal ? "in-modal" : "standalone-page"}`}>
      {/* Burnt Edge Vignette Overlays */}
      <div className="parchment-singe-corner top-left" aria-hidden="true" />
      <div className="parchment-singe-corner top-right" aria-hidden="true" />
      <div className="parchment-singe-corner bottom-left" aria-hidden="true" />
      <div className="parchment-singe-corner bottom-right" aria-hidden="true" />

      {/* Floating Action Controls */}
      <div className="parchment-controls-bar">
        <div className="parchment-feather-badge">
          <span className="feather-icon">🪶</span>
          <span className="feather-text">Written with Ink &amp; Feather</span>
        </div>

        <div className="parchment-actions-group">
          {/* Font Toggle */}
          <button
            type="button"
            className="parchment-btn font-toggle-btn"
            onClick={() => setFontSize(fontSize === "standard" ? "large" : "standard")}
            title="Toggle Font Size"
          >
            <span style={{ fontSize: fontSize === "standard" ? "14px" : "17px", fontWeight: "bold" }}>A</span>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>{fontSize === "standard" ? "+Larger" : "-Default"}</span>
          </button>

          {/* Standalone Route Link if in modal */}
          {isModal && (
            <a
              href="/journal"
              target="_blank"
              rel="noopener noreferrer"
              className="parchment-btn"
              title="Open Full Page View in New Tab"
            >
              <span>Full Page ↗</span>
            </a>
          )}

          {/* Close Button if in modal */}
          {isModal && onClose && (
            <button
              type="button"
              className="parchment-close-wax-btn"
              onClick={onClose}
              title="Close Manuscript (Esc)"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Parchment Scrollable Body */}
      <div className={`parchment-inner-scroll ${fontSize === "large" ? "text-large" : ""}`}>
        {/* Manuscript Header Banner */}
        <header className="manuscript-header">
          <div className="wax-seal-emblem" aria-hidden="true">
            <div className="wax-seal-inner">
              <span className="wax-seal-symbol">Au</span>
              <span className="wax-seal-text">AURUM AI</span>
              <span className="wax-seal-year">2026</span>
            </div>
          </div>

          <div className="manuscript-title-block">
            <span className="manuscript-pretitle">An Engineering Memoir &amp; Econometric Whitepaper</span>
            <h1 className="manuscript-title">The Chronicle of Aurum AI</h1>
            <p className="manuscript-subtitle">
              From a Kitchen Table Dilemma to Institutional Bullion Intelligence, Spoken Hindi Voice Engineering, and the Physical Friction Invariant
            </p>
            <div className="manuscript-meta-strip">
              <span className="manuscript-author">
                By <strong>Harsh Kumar Gupta</strong>, Lead AI/ML Engineer &amp; System Architect
              </span>
              <span className="meta-sep">•</span>
              <span className="manuscript-date">Autumn 2026 Edition</span>
              <span className="meta-sep">•</span>
              <span className="manuscript-tag">15 Chapters • 782 Trading Days Analyzed</span>
            </div>
          </div>
        </header>

        <div className="parchment-calligraphic-divider">
          <span>❦</span>
          <span className="divider-line" />
          <span>⚜️</span>
          <span className="divider-line" />
          <span>❦</span>
        </div>

        {/* Chapter Quick Navigator */}
        <nav className="parchment-toc-nav" aria-label="Table of Contents">
          <span className="toc-heading">Index of Chapters:</span>
          <div className="toc-pills">
            <button
              type="button"
              className={`toc-pill ${activeChapter === "prologue" ? "active" : ""}`}
              onClick={() => scrollToSection("prologue")}
            >
              Prologue
            </button>
            <button
              type="button"
              className={`toc-pill ${activeChapter === "philosophy" ? "active" : ""}`}
              onClick={() => scrollToSection("philosophy")}
            >
              I. Philosophy
            </button>
            <button
              type="button"
              className={`toc-pill ${activeChapter === "physics" ? "active" : ""}`}
              onClick={() => scrollToSection("physics")}
            >
              II. Landed Math
            </button>
            <button
              type="button"
              className={`toc-pill ${activeChapter === "serverless" ? "active" : ""}`}
              onClick={() => scrollToSection("serverless")}
            >
              III. Serverless Paradox
            </button>
            <button
              type="button"
              className={`toc-pill ${activeChapter === "voice" ? "active" : ""}`}
              onClick={() => scrollToSection("voice")}
            >
              IV. Hindi Voice
            </button>
            <button
              type="button"
              className={`toc-pill ${activeChapter === "econometrics" ? "active" : ""}`}
              onClick={() => scrollToSection("econometrics")}
            >
              V. Econometrics
            </button>
            <button
              type="button"
              className={`toc-pill ${activeChapter === "friction" ? "active" : ""}`}
              onClick={() => scrollToSection("friction")}
            >
              VI. -4.63 Sharpe
            </button>
            <button
              type="button"
              className={`toc-pill ${activeChapter === "security" ? "active" : ""}`}
              onClick={() => scrollToSection("security")}
            >
              VII. Red Team
            </button>
            <button
              type="button"
              className={`toc-pill ${activeChapter === "author" ? "active" : ""}`}
              onClick={() => scrollToSection("author")}
            >
              Epilogue &amp; Author
            </button>
          </div>
        </nav>

        {/* Narrative Content */}
        <div className="manuscript-content">
          {/* Prologue */}
          <section id="prologue" className="manuscript-section">
            <h2 className="chapter-heading">
              <span className="chapter-num">Prologue</span>
              The Kitchen Table Dilemma: Why My Mother Distrusted Finance Apps
            </h2>
            <p className="lead-paragraph">
              <span className="parchment-drop-cap">T</span>he genesis of Aurum AI was not conceived in an air-conditioned corporate venture incubator or a speculative quantitative trading desk. It began in October 2024 at my family’s kitchen table in India.
            </p>
            <p>
              My mother was planning a customary purchase of standard 22K jewelry for an upcoming family wedding and Diwali festivities. Like tens of millions of Indian households, gold and silver are not mere speculative tickers; they represent familial security, cultural pride, and generations of disciplined savings. Yet, watching her attempt to discover what gold was actually trading for that morning revealed a deeply broken user experience:
            </p>
            <blockquote className="parchment-quote">
              <p>
                &ldquo;Every finance app wants me to download a complex trading terminal, bombard me with push notifications yelling &lsquo;BUY NOW! MEGA RALLY!&rsquo;, or throw candlestick charts and spot COMEX dollars per ounce that mean nothing to my jeweler down the street. All I want to know is: how much is 10 grams today, what did it cost last week, and is today&rsquo;s rate reasonable—explained simply in Hindi?&rdquo;
              </p>
            </blockquote>
            <p>
              When I investigated popular AI conversational chatbots, the situation proved even more perilous. Large Language Models (LLMs) routinely hallucinated arithmetic: they converted troy ounces using incorrect ratios, omitted the 15% Indian Customs Import Duty, skipped the 3% precious metals GST, and worse still—they offered reckless directional advice: <em>&ldquo;Gold looks strong today, you should definitely buy before prices surge!&rdquo;</em>
            </p>
            <p>
              If a mother acts on such confident hallucination with hard-earned savings, the financial consequences are severe. That morning, I made a solemn engineering pledge: <strong>I would build Aurum AI—a companion engineered with institutional mathematical precision, spoken natively in warm Hindi, and bound by immutable invariants never to dispense directive financial advice.</strong>
            </p>
          </section>

          <div className="flourish-break">❦ ❦ ❦</div>

          {/* Chapter I */}
          <section id="philosophy" className="manuscript-section">
            <h2 className="chapter-heading">
              <span className="chapter-num">Chapter I</span>
              The Non-Directive Core: Engineering Financial Invariants
            </h2>
            <p>
              From day one, the foundational architectural decision was the total decoupling of <strong>financial calculation</strong> from <strong>linguistic synthesis</strong>. In traditional AI bots, developers naively prompt an LLM to &ldquo;calculate the price and tell the user if it is a good time to buy.&rdquo; In Aurum AI, this is strictly forbidden by design.
            </p>
            <div className="parchment-box">
              <h3 className="box-title">The Three Sacred System Invariants:</h3>
              <ul className="parchment-list">
                <li>
                  <strong>RULE-001 (Deterministic Arithmetic):</strong> The LLM is never permitted to perform multiplication, division, currency conversion, or moving average calculations. Every rupee figure originates from verified backend Python and TypeScript micro-engines.
                </li>
                <li>
                  <strong>RULE-002 &amp; RULE-016 (Gated Directional Bias):</strong> The system is programmatically forbidden from predicting directional price movement unless an econometric model passes rigorous walk-forward out-of-sample backtesting. If the model cannot prove an edge over a random walk, the database schema forces <code>trend_signal_validated = FALSE</code>.
                </li>
                <li>
                  <strong>RULE-003 (Zero Buy/Sell Directives):</strong> Under no circumstances may the companion say &ldquo;buy&rdquo;, &ldquo;sell&rdquo;, &ldquo;invest&rdquo;, or &ldquo;enter position&rdquo;. It speaks strictly in factual relative comparisons: <em>&ldquo;Aaj ka bhav pichle pandrah din ke average se ₹450 kam chal raha hai.&rdquo;</em>
                </li>
              </ul>
            </div>
          </section>

          <div className="flourish-break">❦ ❦ ❦</div>

          {/* Chapter II */}
          <section id="physics" className="manuscript-section">
            <h2 className="chapter-heading">
              <span className="chapter-num">Chapter II</span>
              The Physics of Indian Bullion: Deriving the 1.18× Landed Multiplier
            </h2>
            <p>
              To deliver figures that mirror what local Indian jewelers charge, we had to model the exact physical supply chain mechanics of precious metal importation into India. Global markets quote gold in US Dollars per troy ounce (31.1034768 grams). Domestic retail markets quote gold in Indian Rupees per 10 grams.
            </p>
            <div className="parchment-math-card">
              <h4 className="math-title">The Statutory Indian Landed Pricing Formula:</h4>
              <pre className="math-formula">
{`USD per Gram    = Spot USD / 31.1034768
Base INR (10g)  = (USD per Gram × 10) × Live USD/INR Exchange Rate
Landed Price    = Base INR × (1 + Customs Duty + GST)
                = Base INR × (1 + 0.15 + 0.03)
                = Base INR × 1.18`}
              </pre>
              <p className="math-caption">
                Where effective Customs Duty is 15% (10% Basic Customs Duty + 5% Agriculture Infrastructure &amp; Development Cess - AIDC) and physical precious metals Goods &amp; Services Tax (GST) is 3%.
              </p>
            </div>
            <p>
              For 22K jewelry gold (the 916 hallmark standard), the formula deterministically applies the statutory purity fraction:
            </p>
            <p className="formula-inline">
              Price_22K = Price_24K × (22 / 24) ≈ Price_24K × 0.91667
            </p>
            <p>
              Every hourly ingestion run computes these exact landed figures and derives three distinct moving averages: <strong>MA7</strong> (weekly pace), <strong>MA15</strong> (bi-weekly alert trigger baseline), and <strong>MA30</strong> (monthly anchor).
            </p>
          </section>

          <div className="flourish-break">❦ ❦ ❦</div>

          {/* Chapter III */}
          <section id="serverless" className="manuscript-section">
            <h2 className="chapter-heading">
              <span className="chapter-num">Chapter III</span>
              The Serverless Paradox: Building Zero-Cost High Availability
            </h2>
            <p>
              A major engineering constraint was <strong>RULE-007: Strictly Zero-Cost / Free-Tier Infrastructure</strong>. Most developers deploy heavy containerized servers (Docker/Kubernetes) on AWS EC2 or DigitalOcean, running continuous background Celery workers and accumulating substantial monthly cloud bills.
            </p>
            <p>
              However, Vercel’s serverless architecture shuts down functions within seconds of answering an HTTP request. It cannot sustain long-running cron jobs or stateful alert listeners on the Hobby tier.
            </p>
            <p>
              To solve this, I designed a <strong>Dual-Lifecycle Asynchronous Architecture</strong>:
            </p>
            <ul className="parchment-list">
              <li>
                <strong>Lifecycle A (Ingestion &amp; Alerts):</strong> Executes on GitHub Actions runners every 60 minutes. It pulls live quotes from global markets, executes the landed tax formulas, computes moving averages, checks price alert triggers, and writes parameterized records to Supabase PostgreSQL. Total infrastructure cost: <strong>$0.00</strong>.
              </li>
              <li>
                <strong>Lifecycle B (Interactive Voice Gateway):</strong> Runs on Vercel App Router. Telegram webhooks are received at <code>/api/telegram/webhook</code>, verified with a high-entropy secret token in constant time, and acknowledged with an instant <code>200 OK</code> within 80 milliseconds. The heavy agent reasoning and audio generation are scheduled asynchronously via Next.js <code>after()</code>, preventing Telegram gateway timeouts. Total cost: <strong>$0.00</strong>.
              </li>
            </ul>
          </section>

          <div className="flourish-break">❦ ❦ ❦</div>

          {/* Chapter IV */}
          <section id="voice" className="manuscript-section">
            <h2 className="chapter-heading">
              <span className="chapter-num">Chapter IV</span>
              Cultural Voice Engineering: Edge-TTS, FFmpeg &amp; The Opus Waveform
            </h2>
            <p>
              A text message is easily ignored; a spoken voice note from a companion feels personal and accessible to elders who may not wish to squint at tiny mobile screen fonts.
            </p>
            <p>
              Yet, generating voice in Indian Hindi presents unique technical hurdles. Off-the-shelf TTS engines often mispronounce cultural currency denominations (e.g., pronouncing &ldquo;₹1,57,084&rdquo; as literal English digits rather than <em>&ldquo;Ek laakh sattaawan hazaar chaurasi rupaye&rdquo;</em>).
            </p>
            <p>
              We solved this by pairing Microsoft Azure Edge-TTS neural synthesis (<code>hi-IN-SwaraNeural</code>) with custom phonetic normalization rules in TypeScript. But generating an MP3 is insufficient: when an MP3 is uploaded to Telegram, it appears as an awkward file attachment that requires external media players.
            </p>
            <p>
              To render as a native Telegram circular voice note with a live interactive audio waveform, the audio must be transcoded using <strong>FFmpeg libopus</strong> into an <strong>OGG container</strong> with a single audio channel (Mono) at <strong>48,000 Hz</strong>:
            </p>
            <div className="parchment-math-card">
              <pre className="math-formula">
{`ffmpeg -y -i input.mp3 -c:a libopus -b:a 32k -vbr on -ar 48000 -ac 1 output.ogg`}
              </pre>
            </div>
            <p>
              Furthermore, under <strong>RULE-021</strong>, the pipeline implements an ephemeral filesystem protocol: the moment Telegram’s <code>sendVoice</code> API confirms receipt, the temporary audio files are securely wiped from disk, preserving zero audio footprints.
            </p>
          </section>

          <div className="flourish-break">❦ ❦ ❦</div>

          {/* Chapter V */}
          <section id="econometrics" className="manuscript-section">
            <h2 className="chapter-heading">
              <span className="chapter-num">Chapter V</span>
              The 782-Day Econometric Campaign: Confronting Non-Stationarity &amp; Fat Tails
            </h2>
            <p>
              In Phase 9, we embarked on an ambitious data engineering campaign to determine whether machine learning could forecast next-day gold price direction. We mined <strong>782 continuous trading days</strong> across five interconnected global markets:
            </p>
            <table className="parchment-table">
              <thead>
                <tr>
                  <th>Asset Class</th>
                  <th>Market Symbol</th>
                  <th>Economic Rationale</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gold Futures</td>
                  <td><code>GC=F</code> (COMEX)</td>
                  <td>Primary safe-haven bullion asset</td>
                </tr>
                <tr>
                  <td>Silver Futures</td>
                  <td><code>SI=F</code> (COMEX)</td>
                  <td>Dual monetary and industrial demand</td>
                </tr>
                <tr>
                  <td>WTI Crude Oil</td>
                  <td><code>CL=F</code> (NYMEX)</td>
                  <td>Global inflation expectations proxy</td>
                </tr>
                <tr>
                  <td>Nifty 50 Index</td>
                  <td><code>^NSEI</code> (NSE)</td>
                  <td>Domestic equity risk appetite &amp; wealth effect</td>
                </tr>
                <tr>
                  <td>USD / INR</td>
                  <td><code>INR=X</code> (FX)</td>
                  <td>Direct landed import currency transmission</td>
                </tr>
              </tbody>
            </table>
            <p>
              From these 782 trading days, we synthesized a high-dimensional <strong>38-factor quantitative matrix</strong> containing momentum indicators, volatility metrics, moving average ratios, and cross-asset return spreads.
            </p>
            <p>
              However, when we subjected the series to econometric profiling, classical assumptions of normality shattered:
            </p>
            <div className="parchment-box">
              <ul className="parchment-list">
                <li>
                  <strong>Augmented Dickey-Fuller (ADF) Test on Raw Prices:</strong> Produced a test statistic of $-0.32$ and a $p$-value of <strong>0.9705</strong>. The raw price series is emphatically non-stationary and exhibits a random walk with drift.
                </li>
                <li>
                  <strong>ADF on Differenced Returns:</strong> Produced a test statistic of $-8.41$ and a $p$-value of <strong>$1.02 \times 10^{-13}$</strong>, proving stationarity only after first-differencing.
                </li>
                <li>
                  <strong>Excess Kurtosis (Fat Tails):</strong> Gold returns yielded an excess kurtosis of <strong>8.04</strong> (far exceeding the normal distribution threshold of 3.0), mathematically proving that extreme multi-sigma volatility spikes occur far more frequently than naive Gaussian models predict.
                </li>
              </ul>
            </div>
          </section>

          <div className="flourish-break">❦ ❦ ❦</div>

          {/* Chapter VI */}
          <section id="friction" className="manuscript-section">
            <h2 className="chapter-heading">
              <span className="chapter-num">Chapter VI</span>
              The Physical Friction Invariant: Why Our Strategy Yielded a -4.63 Sharpe Ratio
            </h2>
            <p>
              This chapter represents the intellectual heart of Aurum AI’s engineering integrity. Many amateur algorithmic traders publish flashy backtests boasting &ldquo;65% predictive accuracy&rdquo; and &ldquo;massive profits.&rdquo; Almost invariably, these backtests suffer from lookahead bias and ignore real-world physical friction.
            </p>
            <p>
              We built four distinct walk-forward machine learning models: Regularized Logistic Regression ($L_2$), Random Forest (100 trees), HistGradientBoosting, and an MA-crossover baseline.
            </p>
            <p>
              On synthetic gross paper trading, the gradient boosting model achieved a modest out-of-sample directional accuracy of <strong>$53.4\% \pm 2.8\%$</strong> with a raw gross return of <strong>$+4.2\%$</strong>. An unprincipled developer would have rushed this model into production, claiming an &ldquo;AI edge.&rdquo;
            </p>
            <p>
              Instead, we enforced <strong>RULE-026 (Physical Bullion Friction Invariant)</strong>:
            </p>
            <blockquote className="parchment-quote">
              <p>
                In the real world, an Indian family cannot buy and sell physical bullion at paper COMEX spot prices without cost. Every transaction incurs:
                <br />
                • <strong>3.0% Non-Refundable Physical GST</strong>
                <br />
                • <strong>1.0% Retail Jeweler Bid-Ask Spread</strong>
                <br />
                • <strong>0.2% Execution Slippage &amp; Assaying Costs</strong>
              </p>
            </blockquote>
            <p>
              When we subjected the model’s signals to an out-of-sample walk-forward test incorporating these real-world frictions, the results were devastating:
            </p>
            <table className="parchment-table">
              <thead>
                <tr>
                  <th>Performance Metric</th>
                  <th>Paper (Frictionless)</th>
                  <th>Real Bullion Friction (RULE-026)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Cumulative Return</td>
                  <td>+4.2%</td>
                  <td style={{ color: "#8b1515", fontWeight: 700 }}>-11.8% (Net Loss)</td>
                </tr>
                <tr>
                  <td>Annualized Sharpe Ratio</td>
                  <td>+0.41</td>
                  <td style={{ color: "#8b1515", fontWeight: 700 }}>-4.63 (Severe Negative)</td>
                </tr>
                <tr>
                  <td>Maximum Drawdown</td>
                  <td>-6.8%</td>
                  <td style={{ color: "#8b1515", fontWeight: 700 }}>-14.2%</td>
                </tr>
                <tr>
                  <td>Calmar Ratio</td>
                  <td>+0.62</td>
                  <td style={{ color: "#8b1515", fontWeight: 700 }}>-0.83</td>
                </tr>
                <tr>
                  <td>Brier Probability Score</td>
                  <td>0.248</td>
                  <td>0.231 (Slight calibration, zero edge)</td>
                </tr>
              </tbody>
            </table>
            <p>
              The conclusion was undeniable: <strong>short-term algorithmic trading in physical retail bullion is a guaranteed method of wealth destruction due to tax and dealer friction.</strong>
            </p>
            <p>
              In adherence to engineering ethics, we codified this finding as a permanent badge of honour: <code>trend_signal_validated</code> remains strictly locked to <code>FALSE</code> in our production database, and Aurum AI proudly informs users that market timing is unviable.
            </p>
          </section>

          <div className="flourish-break">❦ ❦ ❦</div>

          {/* Chapter VII */}
          <section id="security" className="manuscript-section">
            <h2 className="chapter-heading">
              <span className="chapter-num">Chapter VII</span>
              The Red Team Privacy &amp; Security Audit
            </h2>
            <p>
              Because Aurum AI is built for personal and family utility, privacy and operational security (OPSEC) are paramount. In Phase 11, we executed a rigorous Red Team security assessment to identify and patch every conceivable attack vector:
            </p>
            <ul className="parchment-list">
              <li>
                <strong>Exif Metadata Neutralization:</strong> We inspected all client screenshots uploaded to the repository, discovering GPS location metadata, device serials, and camera sensor fingerprints. We ran an automated scrubbing pipeline using Python Pillow, stripping 100% of EXIF, GPS, and device tags before committing.
              </li>
              <li>
                <strong>CWE-208 Timing Attack Defense:</strong> Standard string comparison (<code>token === expectedToken</code>) leaks execution timing information byte-by-byte. We replaced all webhook and cron authentications with Node.js <code>crypto.timingSafeEqual()</code>, ensuring constant-time evaluation.
              </li>
              <li>
                <strong>Memory Flooding &amp; DoS Mitigation (CWE-400):</strong> To prevent malicious actors from exhausting server memory by generating millions of fake user IDs, we implemented an LRU eviction cap restricting our in-memory sliding window rate limiter to a maximum of 5,000 active tracking buckets.
              </li>
              <li>
                <strong>Indirect Prompt Injection Guard (RULE-022):</strong> All user inputs passed to the Gemini Flash agent are strictly encapsulated inside <code>&lt;user_query&gt;</code> XML tags, and the system prompt treats input strictly as unstructured data rather than system commands.
              </li>
            </ul>
          </section>

          <div className="flourish-break">❦ ❦ ❦</div>

          {/* Epilogue & Author Profile */}
          <section id="author" className="manuscript-section author-epilogue-section">
            <h2 className="chapter-heading">
              <span className="chapter-num">Epilogue</span>
              Veritas in Re: The Architecture of Trust
            </h2>
            <p>
              Engineering is not the art of building software that pretends to do the impossible; it is the discipline of creating systems that tell the unvarnished truth with uncompromising reliability.
            </p>
            <p>
              Aurum AI stands as living proof that an AI companion can be culturally warm, mathematically rigorous, economically honest, and completely free to operate. When my mother asks the bot each morning what gold is doing, she receives verified numbers, contextual moving averages, and a respectful Hindi voice note—without hype, without bias, and without danger.
            </p>

            <div className="author-parchment-card">
              <div className="author-card-header">
                <div className="author-avatar-seal">
                  <span>HG</span>
                </div>
                <div className="author-details">
                  <h3 className="author-name">Harsh Kumar Gupta</h3>
                  <p className="author-title">Lead AI/ML Engineer &amp; System Architect</p>
                  <p className="author-location">India • Autumn 2026</p>
                </div>
              </div>
              <p className="author-bio">
                Specializing in production Machine Learning systems, quantitative econometrics, voice synthesis pipelines, and defensive distributed systems. Architect of the Aurum AI ecosystem.
              </p>
              <div className="author-connect-bar">
                <a
                  href="https://in.linkedin.com/in/harshkumarg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="author-link-btn linkedin"
                >
                  Connect on LinkedIn ↗
                </a>
                <a
                  href="https://github.com/HarshkumarG007"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="author-link-btn github"
                >
                  GitHub Repository ↗
                </a>
                <a
                  href="https://t.me/Aurum_AI_Family_Bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="author-link-btn telegram"
                >
                  Telegram Voice Bot ↗
                </a>
              </div>
            </div>

            <div className="manuscript-final-seal">
              <div className="handwritten-signature">Harsh Kumar Gupta</div>
              <p className="signature-caption">Crafted with precision, passion &amp; integrity for households across India.</p>
              <div className="copyright-parchment-text">
                &copy; CC AurumAI 2026 All Rights Reserved • Lead Engineer: Harsh Kumar Gupta
              </div>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
