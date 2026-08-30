import { useEffect } from "react";

interface SeoProps {
  title?: string;
  description?: string;
  /** Marks the page noindex,nofollow while mounted (private pages). */
  noindex?: boolean;
}

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function Seo({ title, description, noindex = false }: SeoProps) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) setMeta("description", description);
    if (noindex) setMeta("robots", "noindex, nofollow, noarchive");
    return () => {
      if (noindex) {
        const el = document.querySelector('meta[name="robots"]');
        if (el) el.setAttribute("content", "index, follow");
      }
    };
  }, [title, description, noindex]);
  return null;
}

export default Seo;
