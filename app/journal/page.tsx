import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import JournalManuscript from "../components/JournalManuscript";

export const metadata: Metadata = {
  title: "The Chronicle of Aurum AI — Engineering Monograph & First-Person Retrospective",
  description:
    "First-person engineering journal by Harsh Kumar Gupta, Lead AI/ML Engineer, detailing the architectural journey from household dilemma to 782-day cross-asset econometric mining, spoken Hindi voice synthesis, and the physical bullion friction invariant.",
  openGraph: {
    title: "The Chronicle of Aurum AI — Engineering Monograph by Harsh Kumar Gupta",
    description:
      "From a kitchen table dilemma to institutional-grade bullion intelligence. The complete engineering memoir of Aurum AI.",
    type: "article",
  },
};

export default function JournalPage() {
  return (
    <main className="journal-page-wrapper">
      {/* Top Vintage Navigation Header */}
      <header className="journal-page-navbar">
        <div className="journal-page-nav-inner">
          <Link href="/" className="journal-back-link">
            <span className="back-arrow">←</span>
            <span>Return to Live Command Center</span>
          </Link>

          <div className="journal-header-center">
            <span className="journal-brand-badge">Aurum AI • Engineering Monograph</span>
          </div>

          <div className="journal-header-right">
            <a
              href="https://in.linkedin.com/in/harshkumarg"
              target="_blank"
              rel="noopener noreferrer"
              className="journal-author-badge"
            >
              <span>Harsh Kumar Gupta (LinkedIn) ↗</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Manuscript Presentation Container */}
      <div className="journal-page-container">
        <JournalManuscript isModal={false} />
      </div>

      {/* Standalone Journal Page Footer */}
      <footer className="journal-page-footer">
        <div className="journal-footer-inner">
          <div className="journal-footer-brand">
            <span className="gold-text">Aurum AI (औरम एआई)</span>
            <span className="footer-pipe">•</span>
            <span>CC AurumAI 2026 All Rights Reserved</span>
          </div>
          <div className="journal-footer-author">
            Crafted with <span className="pulsing-heart">❤️</span> by{" "}
            <a
              href="https://in.linkedin.com/in/harshkumarg"
              target="_blank"
              rel="noopener noreferrer"
              className="creator-name-link"
            >
              Harsh Kumar Gupta
            </a>
            , AI/ML Engineer
          </div>
        </div>
      </footer>
    </main>
  );
}
