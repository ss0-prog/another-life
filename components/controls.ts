export const chipClass = (active: boolean) =>
  `border px-4 py-2 text-sm leading-6 tracking-wider transition-colors ${
    active ? "border-warm bg-warm/10 text-mist" : "border-line text-haze hover:border-haze hover:text-mist"
  }`;

export const numberInputClass =
  "w-24 border-b border-line bg-transparent py-2 text-center text-2xl tracking-widest text-mist outline-none transition-colors placeholder:text-dim focus:border-haze [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export const selectClass =
  "mt-3 w-full max-w-xs border-b border-line bg-panel py-2 text-base tracking-wider text-mist outline-none transition-colors focus:border-haze";

export const primaryButtonClass =
  "group relative px-8 py-3 text-sm tracking-[0.3em] text-mist transition-opacity disabled:opacity-40";
