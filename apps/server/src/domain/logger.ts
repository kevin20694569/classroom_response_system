/** 領域層使用的最小 log 介面（實際由 pino 提供；領域層不直接依賴 log 套件）。 */
export interface DomainLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}
