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
      });
      await espRef.current.main_fn();
    } catch (e) {
      await disconnect();
      throw e;
    }
  };

  const disconnect = async () => {
    if (!espRef.current) return;

    try {
      await sleep(100);
      await espRef.current.hard_reset();

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

    let serialOutput: string[] = [];
    await new Promise(async (resolve, reject) => {
      if (!espRef.current) return;

      let timedOut = false;
      const readerPromise = new Promise(async (resolve, reject) => {
        if (!espRef.current) return;

        console.log("Opening serial console...");
        const textDecoder = new TextDecoder();
        let lineBuffer = "";
        let timeouts = 0;
        while (!timedOut) {
          while (!lineBuffer.includes("\n")) {
            try {
              const readBytes = await espRef.current.transport.rawRead(8000);
              timeouts = 0;
              if (readBytes === undefined) continue;
              lineBuffer += textDecoder.decode(readBytes);
              // Cut output that's obscenely long
              if (lineBuffer.length > 4096) break;
            } catch (e) {
              // Ignore timeout
              if (e instanceof Error && e.message === "Timeout") {
                if (++timeouts >= 16) {
                  console.error("Timed out too many times:", e);
                  reject(
                    new SerialError("Timed out too many times", serialOutput),
                  );
                  return;
                }
              } else {
                console.error(e);
                reject(new SerialError("Serial error", serialOutput));
                return;
              }
            }
          }

          // Cut on the newline
          const [, line, remainder] = RegExp(/(.*?)\n(.*)/).exec(
            lineBuffer,
          ) ?? [undefined, lineBuffer, ""];
          lineBuffer = remainder;

          console.log("Serial Console:", line);
          serialOutput.push(line);

          if (line.includes("CMD SET WIFI OK")) {
            console.log("WiFi serial command was successful.");
          }
          if (line.includes("Connected successfully to SSID")) {
            resolve(true);
            return;
          }
          if (line.includes("Can't connect from any credentials")) {
            reject(new SerialError("Invalid credentials", serialOutput));
            return;
          }
        }
        // Timeout if exited
        reject(new SerialError("Timeout", serialOutput));
      });

      console.log("Resetting ESP...");
      await espRef.current.hard_reset();

      console.log("Waiting for ESP to boot...");
      await sleep(500);

      console.log("Setting WiFi via serial command...");
      const writer = espRef.current.transport.device.writable?.getWriter();
      if (!writer) {
        return reject(new SerialError("Device is not writable", serialOutput));
      }
      try {
        writer.write(
          new TextEncoder().encode(`SET WIFI "${ssid}" "${password}"\n`),
        );
      } finally {
        writer.releaseLock();
      }

      console.log("Waiting for WiFi connection...");
      setTimeout(() => {
        timedOut = true;
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
    eraseFlash: () => espRef.current?.erase_flash(),
    isConnected: () => espRef.current,
    setWifi,
    serialSupported,
    espRef,
  };
}
