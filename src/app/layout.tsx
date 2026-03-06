import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Refinr — Polish AI Text Into Natural Prose",
    description:
        "Transform stiff, robotic AI-generated text into natural, professional prose. Ethical writing assistance for readability, clarity, and style.",
    keywords: [
        "AI text editor",
        "refinr text",
        "readability improvement",
        "writing assistant",
        "AI editing tool",
    ],
    openGraph: {
        title: "Refinr — Polish AI Text Into Natural Prose",
        description:
            "Ethical AI writing assistant. Improve readability and style, not bypass detection.",
        type: "website",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}
