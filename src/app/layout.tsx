import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { SessionProvider } from "@/lib/SessionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { parseCookieString, THEME_COOKIE_NAME, MODE_COOKIE_NAME } from "@/lib/theme-cookies";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SUKI ERP — Tools Management",
  description:
    "Manage your tools, calibration schedules, and issue/receive workflows with SUKI ERP Tools Management module.",
  keywords: ["ERP", "tools management", "calibration", "SUKI"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const { theme, mode } = parseCookieString(cookieHeader);

  const antiFoucScript = `(function() {
    try {
      var cookies = document.cookie.split(';');
      var theme = '${theme}';
      var mode = '${mode}';
      for (var i = 0; i < cookies.length; i++) {
        var parts = cookies[i].trim().split('=');
        if (parts[0] === '${THEME_COOKIE_NAME}' && parts[1]) theme = parts[1];
        if (parts[0] === '${MODE_COOKIE_NAME}' && parts[1]) mode = parts[1];
      }
      var doc = document.documentElement;
      doc.setAttribute('data-theme', theme);
      doc.setAttribute('data-mode', mode);
      if (mode === 'dark') {
        doc.classList.add('dark');
      } else {
        doc.classList.remove('dark');
      }
    } catch (e) {}
  })();`;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${mode === "dark" ? "dark" : ""}`.trim()}
      data-theme={theme}
      data-mode={mode}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: antiFoucScript }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider initialTheme={theme} initialMode={mode}>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
