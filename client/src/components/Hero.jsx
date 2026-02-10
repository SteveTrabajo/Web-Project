import React from "react";

/**
 * Hero.jsx
 * -----------
 * Main landing section of BIO-BOT.
 * Displays the hero banner with background image, project title,
 * short description, and a "Start Chat" button.
 *
 * Props:
 * - onStart(): Function triggered when user clicks the start button.
 */

export default function Hero({ onStart }) {
  return (
    <section
      className="relative w-full min-h-[calc(100vh-64px)] bg-cover bg-center flex items-center overflow-hidden"
      style={{ backgroundImage: "url(/assets/background.png)" }}
      dir="rtl" // Ensures correct RTL layout for Hebrew content
    >
      {/* Dark overlay layer above background image */}
      <div className="absolute inset-0 bg-[#162A5A]/60 pointer-events-none" />

      {/* Hero content */}
      <div className="relative z-10 w-full py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">

            {/* Text and Start button */}
            <div className="flex-1 text-center md:text-right text-white space-y-6">
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
                עוזר חכם לסטודנטים <br className="hidden md:block" />
                <span className="text-[#F5B301]">הנדסת ביוטכנולוגיה</span>
              </h1>

              <p className="text-lg md:text-xl text-blue-100 max-w-2xl">
                מלווה סטודנטים בקורסים, יועצים ולוחות מעבדה –{" "}
                <span className="font-bold">BIO BOT</span>
              </p>

              <div className="pt-4">
                <button
                  onClick={onStart}
                  className="px-10 py-4 rounded-full bg-[#F5B301] text-[#162A5A]
                             font-bold text-lg shadow-lg transition-all 
                             hover:scale-105 hover:bg-[#ffc107] active:scale-95"
                >
                  ▶ התחלת צ׳אט
                </button>
              </div>
            </div>

            {/* Right-side placeholder for future illustration/logo */}
            <div className="flex-1 hidden md:block" />
          </div>
        </div>
      </div>
    </section>
  );
}
