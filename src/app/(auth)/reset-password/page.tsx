"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Loader2 } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const isInvite = params.get("invite") === "1";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    setError("");

    const result = await resetPassword(token, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-[400px]"
    >
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-[17px] font-bold tracking-tight text-foreground">Brokealty CRM</span>
        </div>

        <h1 className="text-[20px] font-semibold text-foreground mb-1">
          {isInvite ? "Crea tu contraseña" : "Nueva contraseña"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {isInvite ? "Define tu contraseña para entrar al equipo." : "Elige una contraseña nueva para tu cuenta."}
        </p>

        {!token ? (
          <p className="text-sm text-red-500">
            El enlace no es válido.{" "}
            <Link href="/forgot-password" className="text-primary hover:underline">Solicita uno nuevo</Link>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8} autoComplete="new-password" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                required minLength={8} autoComplete="new-password" className="h-9" />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full h-9" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar contraseña"}
            </Button>
          </form>
        )}
      </div>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
