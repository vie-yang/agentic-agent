import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="rounded-full bg-slate-100 p-6 mb-6">
        <LayoutDashboard className="h-12 w-12 text-slate-400" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
      <p className="text-muted-foreground max-w-md">
        Halaman dashboard utama akan segera hadir. Silakan gunakan menu di samping untuk mengakses fitur yang tersedia.
      </p>
    </div>
  );
}
