"use client"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
interface StreamdownProps {
children: string
}
export function Streamdown({ children }: StreamdownProps) {
return (
<div className="break-words leading-relaxed">
<ReactMarkdown
remarkPlugins={[remarkGfm]}
components={{
// Customize how specific elements look to match your UI
p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
code: ({ children }) => (
<code className="bg-muted-foreground/20 rounded px-1 py-0.5 font-mono text-xs">
{children}
</code>
),
pre: ({ children }) => (
<pre className="bg-muted-foreground/10 rounded-md p-3 overflow-x-auto my-2">
{children}
</pre>
),
}}
>
{children}
</ReactMarkdown>
</div>
)
}