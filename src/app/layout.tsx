import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
const inter = Inter({ subsets: ["latin"] });
export const metadata: Metadata = {
title: "OmniPost AI - AI Social Media Studio",
description: "Automate your social media with AI",
metadataBase: new URL('https://omnipost.one'),
icons: {
icon: '/icon.png', // This is your CPU icon for the browser tab
apple: '/omni.png',
},
openGraph: {
title: 'OmniPost AI',
description: 'Create content that actually sounds like you.',
url: 'https://omnipost.one',
siteName: 'OmniPost AI',
images: [
{
url: '/omni.png', // This is your "A" logo for social media
width: 1200,
height: 630,
},
],
locale: 'en_US',
type: 'website',
},
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