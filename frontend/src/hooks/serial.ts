import { ESPLoader, Transport } from "esptool-js";
import { useMemo, useRef } from "react";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class SerialError extends Error {
  serialOutput?: string[];

  constructor(cause: string, serialOutput?: string[]) {
    super();
    this.cause = cause;
    this.serialOutput = serialOutput;
  }

  public toString(): string {
    const serialText =
      this.serialOutput &&
      `\n\nSerial console:\n${this.serialOutput.join("\n")}`;
    return `${this.cause}${serialText}`;
  }
}

export function useSerial() {
  const espRef = useRef<ESPLoader | null>(null);
  const serialSupported = useMemo(() => "serial" in navigator, []);

  const serialConnect = async () => {
    if (espRef.current) return;

    try {
      espRef.current = new ESPLoader({
        transport: new Transport(await navigator.serial.requestPort()),
        baudrate: 115200,
        romBaudrate: 115200,
        enableTracing: false,
      });
      await espRef.current.main();
    } catch (e) {
      await disconnect();
      throw e;
    }
  };

  const disconnect = async () => {
    if (!espRef.current) return;

    try {
      await sleep(100);
      //      await espRef.current.hardReset();
      //      await espRef.current.constructResetSequence("default_reset");
      await espRef.current.softReset(false);

      await espRef.current.transport.setDTR(false);
      await espRef.current.transport.setRTS(false);
    } catch {}

    try {
      await espRef.current.transport.disconnect();
    } catch {}

    espRef.current = null;
  };

  const setWifi = async (ssid: string, password: string) => {
    if (!espRef.current) throw new Error("Connection not open");

    const serialOutput: string[] = [];
    await new Promise(async (resolve, reject) => {
      if (!espRef.current) return;

      let timedOut = false;
      // Started only after the reset so bootloader replies aren't parsed as console output
      const startReader = () =>
        new Promise((resolve, reject) => {
          if (!espRef.current) return;

          console.log("Opening serial console...");
          const textDecoder = new TextDecoder();
          let lineBuffer = "";
          let finished = false;

          const handleLine = (line: string) => {
            console.log("Serial Console:", line);
            serialOutput.push(line);

            if (line.includes("CMD SET WIFI OK")) {
              console.log("WiFi serial command was successful.");
            }
            if (line.includes("Connected successfully to SSID")) {
              finished = true;
              resolve(true);
            }
            if (line.includes("Can't connect from any credentials")) {
              finished = true;
              reject(new SerialError("Invalid credentials", serialOutput));
            }
          };

          // Transport's own read loop holds the stream lock and collects
          // incoming bytes in its buffer, so poll that instead of rawRead.
          const transport = espRef.current.transport;
          const timer = setInterval(() => {
            if (finished || timedOut) {
              clearInterval(timer);
              return;
            }

            const data = transport.peek();
            if (!data.length) return;
            transport.flushInput();

            lineBuffer += textDecoder.decode(data, { stream: true });

            let newline: number;
            while (!finished && (newline = lineBuffer.indexOf("\n")) !== -1) {
              const line = lineBuffer.slice(0, newline);
              lineBuffer = lineBuffer.slice(newline + 1);
              handleLine(line);
            }

            // Cut output that's obscenely long
            if (!finished && lineBuffer.length > 8000) {
              const line = lineBuffer;
              lineBuffer = "";
              handleLine(line);
            }
          }, 50);
        });

      const esp = espRef.current;
      console.log("Resetting ESP...");
      try {
        await esp.softReset(false);
      } catch (e) {
        console.warn("Soft reset failed:", e);
      }
      // Pulse EN via RTS for boards wired for auto-reset
      try {
        await esp.transport.setDTR(false);
        await esp.transport.setRTS(true);
        await sleep(100);
        await esp.transport.setRTS(false);
      } catch (e) {
        console.warn("Hardware reset failed:", e);
      }

      console.log("Waiting for ESP to boot...");
      await sleep(1500);
      esp.transport.flushInput();
      const readerPromise = startReader();

      const sendCommand = async () => {
        const writer = esp.transport.device.writable?.getWriter();
        if (!writer) {
          throw new SerialError("Device is not writable", serialOutput);
        }
        try {
          await writer.write(
            new TextEncoder().encode(`SET WIFI "${ssid}" "${password}"\n`),
          );
        } finally {
          writer.releaseLock();
        }
      };

      console.log("Setting WiFi via serial command...");
      try {
        await sendCommand();
      } catch (e) {
        return reject(e);
      }
      // The firmware may still be booting, so keep resending until it answers
      const resend = setInterval(() => {
        if (timedOut || serialOutput.some((l) => l.includes("CMD SET WIFI"))) {
          clearInterval(resend);
          return;
        }
        console.log("Resending WiFi serial command...");
        sendCommand().catch(console.error);
      }, 3000);

      console.log("Waiting for WiFi connection...");
      setTimeout(() => {
        timedOut = true;
        clearInterval(resend);
        reject(new SerialError("Timeout", serialOutput));
      }, 30000);
      try {
        resolve(await readerPromise);
      } catch (e) {
        reject(e);
        return;
      }
    });
  };

  return {
    serialConnect,
    disconnect,
    eraseFlash: () => espRef.current?.eraseFlash(),
    isConnected: () => espRef.current,
    setWifi,
    serialSupported,
    espRef,
  };
}
