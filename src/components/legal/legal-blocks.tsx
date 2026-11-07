export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[22px] font-bold text-gray-900 mb-1">{children}</h1>;
}
export function Updated({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-gray-400 mb-6">{children}</p>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[16px] font-semibold text-gray-900 mt-7 mb-2">{children}</h2>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3">{children}</p>;
}
export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 mb-3">{children}</ul>;
}
