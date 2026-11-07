import { Construction } from "lucide-react";

export function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#F5F5F5] p-6">
      <div className="h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center">
        <Construction className="h-7 w-7 text-amber-500" />
      </div>
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <p className="text-[13px] text-muted-foreground text-center max-w-sm">
        Esta sección está en construcción. Pronto vas a poder usarla desde aquí.
      </p>
    </div>
  );
}
