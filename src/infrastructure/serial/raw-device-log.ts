/**
 * Bounded diagnostic log buffer for raw, malformed, or non-JSON serial lines.
 *
 * Microcontrollers emit non-JSON ASCII text during power-on, brownouts,
 * and watchdog resets (e.g. ESP32 ROM bootloader output).
 * This class buffers those diagnostic traces safely without memory leaks
 * and flags detected reset/boot events.
 */

export interface RawLogEntry {
  readonly id: number;
  readonly timestamp: number;
  readonly line: string;
  readonly isBootText: boolean;
}

const BOOT_TEXT_PATTERNS: readonly RegExp[] = [
  /rst:0x[0-9a-fA-F]+/i,
  /boot:0x[0-9a-fA-F]+/i,
  /ets Jun/i,
  /configsip:/i,
  /load:0x[0-9a-fA-F]+/i,
  /entry 0x[0-9a-fA-F]+/i,
  /BROWNOUT_RST/i,
  /SW_CPU_RESET/i,
  /RTCWDT_RTC_RESET/i,
  /TG[01]WDT_SYS_RESET/i,
  /ESP-ROM:/i,
  /Guru Meditation Error/i,
  /abort\(\) was called/i,
];

export function isEsp32BootText(line: string): boolean {
  for (const pattern of BOOT_TEXT_PATTERNS) {
    if (pattern.test(line)) return true;
  }
  return false;
}

export class RawDeviceLog {
  private readonly maxEntries: number;
  private readonly entries: RawLogEntry[] = [];
  private nextId = 1;
  private readonly listeners: Set<(entry: RawLogEntry) => void> = new Set();
  private readonly bootListeners: Set<(entry: RawLogEntry) => void> = new Set();

  constructor(maxEntries = 500) {
    this.maxEntries = Math.max(10, maxEntries);
  }

  public append(line: string, timestamp: number = Date.now()): RawLogEntry {
    const isBoot = isEsp32BootText(line);
    const entry: RawLogEntry = {
      id: this.nextId++,
      timestamp,
      line,
      isBootText: isBoot,
    };

    if (this.entries.length >= this.maxEntries) {
      this.entries.shift();
    }
    this.entries.push(entry);

    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (err) {
        console.error("[RawDeviceLog] Listener error:", err);
      }
    }

    if (isBoot) {
      for (const bootListener of this.bootListeners) {
        try {
          bootListener(entry);
        } catch (err) {
          console.error("[RawDeviceLog] Boot listener error:", err);
        }
      }
    }

    return entry;
  }

  public getEntries(): readonly RawLogEntry[] {
    return [...this.entries];
  }

  public getRecent(count = 50): readonly RawLogEntry[] {
    return this.entries.slice(-count);
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public count(): number {
    return this.entries.length;
  }

  public subscribe(listener: (entry: RawLogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onBootDetected(listener: (entry: RawLogEntry) => void): () => void {
    this.bootListeners.add(listener);
    return () => this.bootListeners.delete(listener);
  }
}
