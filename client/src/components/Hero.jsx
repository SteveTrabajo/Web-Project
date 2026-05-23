import React from "react";

export default function Hero({ onStart }) {
  return (
    <section
      className="relative w-full h-[calc(100vh-72px)] bg-cover bg-center bg-no-repeat overflow-hidden flex items-center"
      style={{ backgroundImage: "url(/assets/background.png)" }}
      dir="rtl"
    >
      {/* Subtle dark overlay to deepen the image */}
      <div className="absolute inset-0 bg-brand-navy/40 pointer-events-none" />

      {/* Content centered on screen */}
      <div className="relative z-10 w-full flex justify-center px-6">

        {/* Semi-transparent bounding box */}
        <div className="backdrop-blur-sm bg-brand-navy/55 border border-white/10 rounded-2xl px-10 py-12 max-w-xl w-full text-center text-white space-y-6 shadow-2xl">

          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            עוזר חכם לסטודנטים
            <br />
            <span className="text-brand-gold">הנדסת ביוטכנולוגיה</span>
          </h1>

          <p className="text-lg text-blue-100/90">
            מלווה סטודנטים בקורסים, יועצים ולוחות מעבדה -{" "}
            <span className="font-bold">BIO BOT 2.0</span>
          </p>

          <button
            onClick={onStart}
            className="mt-2 px-10 py-4 rounded-full bg-brand-gold text-brand-navy font-bold text-lg shadow-lg transition-all duration-200 hover:scale-105 hover:bg-brand-gold-hover active:scale-95"
          >
            התחלת צ׳אט
          </button>

        </div>
      </div>
    </section>
  );
}
