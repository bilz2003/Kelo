/** A meter register rendered as typography — digit cells, like an odometer. Purely presentational. */
export function Register({ value, decimals = 3, unit = "kWh", size = "1rem" }: { value: number; decimals?: number; unit?: string; size?: string }) {
  const [int, frac = ""] = value.toFixed(decimals).split(".");
  return (
    <span className="register" style={{ fontSize: size }} role="img" aria-label={`${value.toFixed(decimals)} ${unit}`}>
      {int.split("").map((d, i) => (
        <span className="cell" key={`i${i}`}>{d}</span>
      ))}
      {frac && <span className="dot">.</span>}
      {frac.split("").map((d, i) => (
        <span className="cell" key={`f${i}`}>{d}</span>
      ))}
      <span className="unit">{unit}</span>
    </span>
  );
}
