"use client";

export function PassGate({
  name,
  onContinue,
}: {
  name: string;
  onContinue: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0c100d]/92 p-6">
      <div className="ritual-panel max-w-md rounded-md p-8 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-[#c9a227]">
          Pass the device
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl">
          {name}
        </h2>
        <p className="mt-3 text-sm text-[#9a917c]">
          Only this researcher should see the next vision.
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 rounded-sm bg-[#c9a227] px-5 py-2 text-sm font-semibold text-[#14110b]"
        >
          I am {name}
        </button>
      </div>
    </div>
  );
}
