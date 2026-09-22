import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { AppToaster, NavigationLoader, ToastProvider } from "@/components/ui";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  parseCookieString,
  THEME_COOKIE_NAME,
  MODE_COOKIE_NAME,
} from "@/lib/theme-cookies";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Suki HRMS",
  description: "Human Resource Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const { theme, mode } = parseCookieString(cookieStore.toString());

  // Applied before paint so a dark/non-default theme never flashes white.
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
      if (mode === 'dark') { doc.classList.add('dark'); }
      else { doc.classList.remove('dark'); }
    } catch (e) {}
  })();`;

  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased ${mode === "dark" ? "dark" : ""}`.trim()}
      data-theme={theme}
      data-mode={mode}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFoucScript }} />
        <link rel="preload" as="image" href={`/branding/suki-hrms-${theme}.svg`} />
      </head>
      <body className="min-h-full font-sans">
        <ThemeProvider initialTheme={theme} initialMode={mode}>
          <ToastProvider>
            <NavigationLoader />
            <AppToaster />
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
