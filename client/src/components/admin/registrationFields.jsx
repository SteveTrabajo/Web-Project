import { useState } from "react";
import { Icons } from "./registrationIcons.jsx";

/*
 * Shared presentational pieces for the registration guidelines editor and the
 * DOCX import screen, so both render identical fields for the same data.
 */

export function Field({ label, children, hint, className = "" }) {
  return (
    <div className={`group flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide transition-colors group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400">
          {label}
        </label>
        {hint && (
          <div className="relative group/hint cursor-help">
            <Icons.Info className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500" />
            <div className="absolute bottom-full mb-2 hidden w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg group-hover/hint:block z-10 left-1/2 -translate-x-1/2 text-center pointer-events-none">
              {hint}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function SectionHeader({ title, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2.5">
        {Icon && <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400"><Icon /></div>}
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      {action}
    </div>
  );
}

export function Btn({ children, className = "", ...props }) {
  return (
    <button
      className={
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 " +
        "bg-white border-slate-200 text-slate-700 shadow-sm " +
        "hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:shadow active:scale-95 " +
        "dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

export function DangerBtn({ children, className = "", ...props }) {
  return (
    <button
      className={
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors " +
        "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-transparent hover:border-red-200 " +
        "dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={
        "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm bg-slate-50/50 " +
        "placeholder-slate-400 text-slate-800 font-medium " +
        "transition-all duration-200 ease-in-out " +
        "focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none " +
        "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:focus:border-indigo-500 dark:focus:bg-slate-800 " +
        (props.className || "")
      }
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className={
        "w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm bg-slate-50/50 " +
        "placeholder-slate-400 text-slate-800 leading-relaxed " +
        "transition-all duration-200 ease-in-out " +
        "focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none " +
        "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:focus:border-indigo-500 dark:focus:bg-slate-800 " +
        "resize-y min-h-30 " +
        (props.className || "")
      }
    />
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800 dark:shadow-none ${className}`}>
      {children}
    </div>
  );
}

// --- Helper Component for Contact Lists to reduce clutter ---
export function ContactSection({ title, items = [], onAdd, onRemove, onChange, type }) {
  const [isOpen, setIsOpen] = useState(false); // Collapsible for cleaner UI on mobile

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800 transition-all hover:border-indigo-300 hover:shadow-md">
      <div
        className="p-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        aria-expanded={isOpen}
      >
        <div className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Icons.Users className="w-4 h-4 text-slate-400" />
          {title}
          <span className="bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px] px-1.5 rounded-full min-w-[1.2rem] text-center">{items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); setIsOpen(true); }}
            className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded transition"
            title="הוסף איש קשר"
          >
            <Icons.Plus />
          </button>
          <Icons.Chevron className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* List */}
      {isOpen && (
        <div className="p-3 bg-white dark:bg-slate-900 space-y-3">
          {items.length === 0 && <div className="text-center text-xs text-slate-400 py-2">אין אנשי קשר ברשימה</div>}

          {items.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 group hover:border-indigo-200 hover:bg-white transition-colors dark:bg-slate-800/40 dark:border-slate-700">
              <div className="flex gap-3 items-start">
                <div className="grow space-y-3">
                  {/* One row per person: name, email, and role-specific fields side by side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="שם">
                      <TextInput value={item.name || ""} onChange={(e) => onChange(idx, "name", e.target.value)} />
                    </Field>
                    <Field label="אימייל">
                      <TextInput value={item.email || ""} onChange={(e) => onChange(idx, "email", e.target.value)} className="ltr text-left" />
                    </Field>

                    {(type === "simple" || type === "lab") && (
                      <Field label="תפקיד">
                        <TextInput value={item.role || ""} onChange={(e) => onChange(idx, "role", e.target.value)} />
                      </Field>
                    )}
                    {type === "simple" && item.phone !== undefined && (
                      <Field label="טלפון">
                        <TextInput value={item.phone || ""} onChange={(e) => onChange(idx, "phone", e.target.value)} className="ltr text-left" />
                      </Field>
                    )}
                    {type === "lab" && (
                      <Field label="איך לפנות?">
                        <TextInput value={item.howToContact || ""} onChange={(e) => onChange(idx, "howToContact", e.target.value)} />
                      </Field>
                    )}
                  </div>

                  {type === "advisor" && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                      <Field label="שיוך אלפביתי ומסלול">
                        <div className="flex gap-2 items-center flex-wrap">
                          <TextInput value={item.assignment?.lastNameFrom || ""} onChange={(e) => { const n = { ...item.assignment, lastNameFrom: e.target.value }; onChange(idx, "assignment", n); }} placeholder="א" className="text-center w-14" />
                          <span className="self-center text-slate-300">-</span>
                          <TextInput value={item.assignment?.lastNameTo || ""} onChange={(e) => { const n = { ...item.assignment, lastNameTo: e.target.value }; onChange(idx, "assignment", n); }} placeholder="ת" className="text-center w-14" />
                          <TextInput value={item.assignment?.track || ""} onChange={(e) => { const n = { ...item.assignment, track: e.target.value }; onChange(idx, "assignment", n); }} placeholder="מסלול" className="grow min-w-40" />
                        </div>
                      </Field>
                    </div>
                  )}
                </div>

                <div className="pt-7 shrink-0">
                  <DangerBtn onClick={() => onRemove(idx)} title="מחיקה"><Icons.Trash /></DangerBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
