import { useEffect } from "react";

const SITE = "Nabb";

/**
 * Sets the tab title (and, optionally, the description meta tag) for the current page and restores
 * the previous description when the page unmounts.
 */
export function useDocumentTitle(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);

  useEffect(() => {
    if (!description) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = description;
    return () => {
      meta.content = previous;
    };
  }, [description]);
}
