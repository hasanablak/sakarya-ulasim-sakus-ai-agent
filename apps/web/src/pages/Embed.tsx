import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChatWidget } from "../components/ChatWidget";

export function EmbedPage() {
  const { slug } = useParams();
  const [q] = useSearchParams();
  const host = q.get("host") || undefined;

  useEffect(() => {
    document.documentElement.classList.add("embed");
    document.title = "SAKUS sohbet";
    return () => document.documentElement.classList.remove("embed");
  }, []);

  if (!slug) return null;
  return (
    <div className="embed-page">
      <ChatWidget slug={slug} embed host={host} />
    </div>
  );
}
