import { useCallback, useEffect, useRef, useState } from "react";
import { serialLog } from "./serial-log";

const BAUD_RATE = 115200;

// Lets the flasher free the port, since only one connection can be open
let activeDisconnect: (() => Promise<boolean>) | null = null;
let activeAttach: ((port: SerialPort) => Promise<void>) | null = null;

// Returns whether the monitor was connected, so it can be resumed afterwards
export const releaseSerialMonitor = async () =>
  (await activeDisconnect?.()) ?? false;

export const resumeSerialMonitor = async (port: SerialPort) => {
  if (!activeAttach) throw new Error("Console is not available");

  // The port may still be closing after the flasher released it
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      if (port.readable || port.writable) {
        try {
          await port.close();
        } catch {}
      }
      await activeAttach(port);
      return;
    } catch (e) {
      lastError = e;
      serialLog.line(`--- Reconnect attempt ${attempt} failed: ${e} ---`);
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastError;
};

export function useSerialMonitor() {
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null,
  );
  const readLoopRef = useRef<Promise<void> | null>(null);
  const [connected, setConnected] = useState(false);

  const disconnect = useCallback(async () => {
    const port = portRef.current;
    if (!port) return false;
    portRef.current = null;

    try {
      await readerRef.current?.cancel();
    } catch {}
    await readLoopRef.current;
    try {
      await port.close();
    } catch {}

    setConnected(false);
    serialLog.line("--- Disconnected ---");
    return true;
  }, []);

  const attach = useCallback(async (port: SerialPort, clear = true) => {
    if (portRef.current) return;

    await port.open({ baudRate: BAUD_RATE });
    portRef.current = port;
    setConnected(true);
    if (clear) serialLog.clear();
    serialLog.line(`--- Connected at ${BAUD_RATE} baud ---`);

    readLoopRef.current = (async () => {
      const decoder = new TextDecoder();
      let pending = "";
      try {
        while (port.readable && portRef.current === port) {
          const reader = port.readable.getReader();
          readerRef.current = reader;
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              if (!value) continue;

              pending += decoder.decode(value, { stream: true });
              serialLog.setTail("");
              const parts = pending.split("\n");
              pending = parts.pop() ?? "";
              for (const part of parts) {
                serialLog.line(part.replace(/\r/g, ""));
              }
              // Show prompts that have no newline yet
              serialLog.setTail(pending.replace(/\r/g, ""));
            }
          } finally {
            reader.releaseLock();
            readerRef.current = null;
          }
        }
      } catch (e) {
        serialLog.line(`--- Read error: ${e} ---`);
      }

      // Stream ended without the user disconnecting, e.g. the device was unplugged
      if (portRef.current === port) {
        portRef.current = null;
        try {
          await port.close();
        } catch {}
        setConnected(false);
        serialLog.line("--- Connection lost ---");
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    if (portRef.current) return;
    await attach(await navigator.serial.requestPort());
  }, [attach]);

  useEffect(() => {
    activeDisconnect = disconnect;
    activeAttach = (port) => attach(port, false);
    return () => {
      if (activeDisconnect === disconnect) activeDisconnect = null;
      activeAttach = null;
    };
  }, [disconnect, attach]);

  // logText lets secrets stay out of the console
  const send = useCallback(async (text: string, logText?: string) => {
    const port = portRef.current;
    if (!port?.writable) return;

    const writer = port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(`${text}\n`));
      serialLog.line(`> ${logText ?? text}`);
    } catch (e) {
      serialLog.line(`--- Send failed: ${e} ---`);
    } finally {
      writer.releaseLock();
    }
  }, []);

  const reboot = useCallback(async () => {
    const port = portRef.current;
    if (!port) return;

    serialLog.line("--- Rebooting device ---");
    try {
      await port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise((r) => setTimeout(r, 100));
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch (e) {
      serialLog.line(`--- Hardware reset failed: ${e} ---`);
    }
    // Also ask the firmware, for boards without reset wiring
    await send("REBOOT");
  }, [send]);

  const factoryReset = useCallback(() => send("FRST"), [send]);
  const getInfo = useCallback(() => send("GET INFO"), [send]);
  const getConfig = useCallback(() => send("GET CONFIG"), [send]);
  const wifiScan = useCallback(() => send("GET WIFISCAN"), [send]);
  const setWifi = useCallback(
    (ssid: string, password: string, base64 = false) => {
      if (base64) {
        // The firmware decodes the raw bytes, so encode the UTF-8 text
        const b64 = (text: string) =>
          btoa(String.fromCharCode(...new TextEncoder().encode(text)));
        const pass = password ? ` ${b64(password)}` : "";
        return send(
          `SET BWIFI ${b64(ssid)}${pass}`,
          `SET BWIFI ${b64(ssid)}${password ? " ****" : ""}`,
        );
      }
      return send(
        `SET WIFI "${ssid}" "${password}"`,
        `SET WIFI "${ssid}" "****"`,
      );
    },
    [send],
  );

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    connect,
    disconnect,
    send,
    reboot,
    factoryReset,
    getInfo,
    getConfig,
    wifiScan,
    setWifi,
  };
}
