/**
 * JSON serialisation safety net.
 *
 * Money is stored as BigInt (poisha). `JSON.stringify` throws on BigInt, so we
 * give BigInt a `toJSON` that emits a plain string. Services should still map
 * money to explicit DTO fields; this only prevents accidental 500s.
 */
export function installBigIntSerializer(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bigIntProto = BigInt.prototype as any;
  if (typeof bigIntProto.toJSON !== "function") {
    Object.defineProperty(bigIntProto, "toJSON", {
      value: function toJSON(this: bigint) {
        return this.toString();
      },
      writable: true,
      configurable: true,
    });
  }
}
