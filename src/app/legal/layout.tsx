import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-white text-sm font-bold">A</div>
            <span className="text-[15px] font-bold text-gray-900">Brokealty CRM</span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-gray-500">
            <Link href="/legal/privacidad" className="hover:text-gray-900">Privacidad</Link>
            <Link href="/legal/terminos" className="hover:text-gray-900">Términos</Link>
            <Link href="/legal/eliminar-datos" className="hover:text-gray-900">Eliminar datos</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <article className="bg-white border border-gray-200 rounded-xl p-8 text-[14px] leading-relaxed text-gray-700">
          {children}
        </article>
      </main>
      <footer className="max-w-3xl mx-auto px-6 pb-10 text-[12px] text-gray-400 text-center">
        © {new Date().getFullYear()} Brokealty CRM. Todos los derechos reservados.
      </footer>
    </div>
  );
}
