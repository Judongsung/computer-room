import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { MEMO_WIDGET_COPY } from "@client/constants/widgets/content";

const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks];

export function MarkdownContent({ markdown }: { readonly markdown: string }) {
  if (markdown.length === 0) {
    return <p className="widget-empty">{MEMO_WIDGET_COPY.EMPTY_CONTENT}</p>;
  }
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>{markdown}</ReactMarkdown>
    </div>
  );
}
