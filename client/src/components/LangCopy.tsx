import { useState } from "react";

export function LangToggle({ lang, onChange }: { lang: "kh" | "en"; onChange: (lang: "kh" | "en") => void }) {
  return (
    <div className="zurs-lang-toggle" role="group" aria-label="Language">
      <button type="button" className={lang === "kh" ? "is-on" : ""} onClick={() => onChange("kh")}>ខ្មែរ</button>
      <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => onChange("en")}>EN</button>
    </div>
  );
}

export function LangCopy({
  kh,
  en,
  labelKh,
  labelEn,
  lang,
  onLang,
}: {
  kh?: string | null;
  en?: string | null;
  labelKh?: string;
  labelEn?: string;
  lang: "kh" | "en";
  onLang: (lang: "kh" | "en") => void;
}) {
  const khText = kh?.trim() || "";
  const enText = en?.trim() || "";
  if (!khText && !enText) return null;
  const both = Boolean(khText && enText && khText !== enText);
  const text = lang === "en" ? (enText || khText) : (khText || enText);
  const label = lang === "en" ? (labelEn || labelKh) : (labelKh || labelEn);
  return (
    <section className="zurs-lang-copy">
      <div className="zurs-lang-copy__bar">
        {label ? <h3>{label}</h3> : <span />}
        {both ? <LangToggle lang={lang} onChange={onLang} /> : null}
      </div>
      <p>{text}</p>
    </section>
  );
}

export function useLangCopy() {
  const [lang, setLang] = useState<"kh" | "en">("kh");
  return { lang, setLang };
}
