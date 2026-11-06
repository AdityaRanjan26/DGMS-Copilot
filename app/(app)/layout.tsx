import { AppShell } from "@/components/app-shell";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AppShell>{children}</AppShell>
    </LanguageProvider>
  );
}


