/**
 * EXAMPLE root layout wiring for a new Next.js App Router project.
 * Copy patterns into your own `app/layout.tsx` — do not use this file as-is
 * if paths / providers differ.
 *
 * Stripped of Tools Management SessionProvider, ERP metadata, and cookie
 * coupling beyond the portable theme cookie helpers.
 */
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css"; // → place export's app/globals.css here (or import from styles/)
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NavigationLoader } from "@/components/NavigationLoader";
import { AppToaster } from "@/components/AppToaster";
import {
  parseCookieString,
  THEME_COOKIE_NAME,
  MODE_COOKIE_NAME,
} from "@/lib/theme-cookies";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "App",
  description: "Built with the exported Suki design system",
};

export default async function RootLayoutExample({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const { theme, mode } = parseCookieString(cookieStore.toString());

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
      if (mode === 'dark') doc.classList.add('dark');
      else doc.classList.remove('dark');
    } catch (e) {}
  })();`;

  return (
    <html
      lang="en"
      className={`${poppins.variable} ${mode === "dark" ? "dark" : ""}`.trim()}
      data-theme={theme}
      data-mode={mode}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFoucScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider initialTheme={theme} initialMode={mode}>
          <NavigationLoader />
          <AppToaster />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
