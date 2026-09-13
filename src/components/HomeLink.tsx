import Link from "next/link";

export function HomeLink({
  className = "text-[0.65rem] uppercase tracking-[0.18em] text-[#9a917c] hover:text-[#e6dcc4]",
}: {
  className?: string;
}) {
  return (
    <Link href="/" className={className}>
      Home
    </Link>
  );
}
