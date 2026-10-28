import { Markdown } from "@tanstack/markdown/react";

// Raw HTML stays escaped and bare URLs stay text: both are @tanstack/markdown's defaults.
export function NotePreview({ content }: { content: string }) {
  return (
    <div className="[&_pre]:bg-muted space-y-2 break-words [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:font-mono [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown>{content}</Markdown>
    </div>
  );
}
