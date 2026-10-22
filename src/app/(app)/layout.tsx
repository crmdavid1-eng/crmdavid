import { AuthGate } from "@/components/AuthGate";
import { CrmProvider } from "@/lib/crm";
import { Shell } from "@/components/Shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGate>
      <CrmProvider>
        <Shell>{children}</Shell>
      </CrmProvider>
    </AuthGate>
  );
}
