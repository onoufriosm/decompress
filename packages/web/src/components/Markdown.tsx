'use client';

import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Partial<Components> = {
    code: ({ className, children }) => {
        const isInline = !className?.includes('language-');
        if (!isInline) {
            return (
                <div className="not-prose flex flex-col">
                    <pre className="text-sm w-full overflow-x-auto dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl dark:text-zinc-50 text-zinc-900">
                        <code className="whitespace-pre-wrap break-words">{children}</code>
                    </pre>
                </div>
            );
        }
        return (
            <code className={`${className || ''} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}>
                {children}
            </code>
        );
    },
    pre: ({ children }) => <>{children}</>,
    ol: ({ children, ...props }) => (
        <ol className="list-decimal list-outside ml-4" {...props}>
            {children}
        </ol>
    ),
    li: ({ children, ...props }) => (
        <li className="py-1" {...props}>
            {children}
        </li>
    ),
    ul: ({ children, ...props }) => (
        <ul className="list-disc list-outside ml-4" {...props}>
            {children}
        </ul>
    ),
    strong: ({ children, ...props }) => (
        <span className="font-semibold" {...props}>
            {children}
        </span>
    ),
    a: ({ children, ...props }) => (
        <a
            className="text-blue-500 hover:underline"
            target="_blank"
            rel="noreferrer"
            {...props}
        >
            {children}
        </a>
    ),
    h1: ({ children, ...props }) => (
        <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
            {children}
        </h1>
    ),
    h2: ({ children, ...props }) => (
        <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
            {children}
        </h2>
    ),
    h3: ({ children, ...props }) => (
        <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
            {children}
        </h3>
    ),
    h4: ({ children, ...props }) => (
        <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
            {children}
        </h4>
    ),
    h5: ({ children, ...props }) => (
        <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
            {children}
        </h5>
    ),
    h6: ({ children, ...props }) => (
        <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
            {children}
        </h6>
    ),
    p: ({ children, ...props }) => (
        <p className="mb-3 last:mb-0" {...props}>
            {children}
        </p>
    ),
    hr: () => (
        <hr className="my-6 border-t border-zinc-200 dark:border-zinc-700" />
    ),
    table: ({ children, ...props }) => (
        <div className="my-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm" {...props}>
                {children}
            </table>
        </div>
    ),
    thead: ({ children, ...props }) => (
        <thead className="bg-zinc-100 dark:bg-zinc-800" {...props}>
            {children}
        </thead>
    ),
    tbody: ({ children, ...props }) => (
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700" {...props}>
            {children}
        </tbody>
    ),
    tr: ({ children, ...props }) => (
        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50" {...props}>
            {children}
        </tr>
    ),
    th: ({ children, ...props }) => (
        <th className="px-3 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-300 dark:border-zinc-600" {...props}>
            {children}
        </th>
    ),
    td: ({ children, ...props }) => (
        <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300" {...props}>
            {children}
        </td>
    ),
    blockquote: ({ children, ...props }) => (
        <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-4 italic text-zinc-600 dark:text-zinc-400" {...props}>
            {children}
        </blockquote>
    ),
};

const remarkPlugins = [remarkGfm];

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
    return (
        <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
            {children}
        </ReactMarkdown>
    );
};

export const Markdown = memo(
    NonMemoizedMarkdown,
    (prevProps, nextProps) => prevProps.children === nextProps.children,
);

export default Markdown;
