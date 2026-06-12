import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Ensure this path matches your global CSS file
const inter = Inter({ subsets: ["latin"] });
export const metadata: Metadata = {
title: "Social AI Studio",
description: "AI-Powered Social Media Automation",
};
export default function RootLayout({
children,
}: {
children: React.ReactNode;
}) {
return (
<html lang="en" className="dark">
<body className={inter.className}>
{children}
</body>
</html>
);
}