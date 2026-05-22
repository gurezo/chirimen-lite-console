/**
 * シリアル／ファイル操作などで catch した unknown を文脈付き Error に包む
 */
export function wrapSerialError(context: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${context}: ${message}`);
}
