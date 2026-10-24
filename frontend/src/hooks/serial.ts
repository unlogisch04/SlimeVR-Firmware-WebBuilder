import { ESPLoader, Transport } from "esptool-js";
import { useMemo, useRef } from "react";
import { serialLog } from "./serial-log";
import { releaseSerialMonitor, resumeSerialMonitor } from "./serial-monitor";

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

// Firmware 0.7.3+ reboots into the bootloader on this command. Older firmware
// and devices already in the bootloader ignore it, so failures are not fatal.
const CONSOLE_BAUD_RATE = 115200;
const FLASH_BAUD_RATE = 921600;

const requestFlashMode = async (port: SerialPort) => {
  try {
    await port.open({ baudRate: CONSOLE_BAUD_RATE });
  } catch (e) {
    console.warn("Could not open port to request flash mode:", e);
    return;
  }

  try {
    serialLog.line("--- Sending: set flashmode ---");
    const writer = port.writable?.getWriter();
    if (writer) {
      try {
        await writer.write(new TextEncoder().encode("set flashmode\n"));
      } finally {
        writer.releaseLock();
      }
      await sleep(1000);
    }
  } catch (e) {
    console.warn("Flash mode request failed:", e);
  } finally {
    try {
      await port.close();
    } catch {}
  }
};

export function useSerial() {
  const resumeMonitorRef = useRef(false);
  const espRef = useRef<ESPLoader | null>(null);
  const serialSupported = useMemo(() => "serial" in navigator, []);

  const serialConnect = async () => {
    if (espRef.current) return;

    await releaseSerialMonitor();
    // Boards with a USB-UART chip keep the port after the reset, so the console
    // always reattaches once the flasher is done (ESP32 native USB may drop it)
    resumeMonitorRef.current = true;
    serialLog.clear();
    try {
      const port = await navigator.serial.requestPort();
      await requestFlashMode(port);
      espRef.current = new ESPLoader({
        transport: new Transport(port),
        baudrate: FLASH_BAUD_RATE,
        romBaudrate: CONSOLE_BAUD_RATE,
        enableTracing: false,
        terminal: {
          clean: () => {},
          write: (data) => serialLog.write(data),
          writeLine: (data) => serialLog.line(data),
        },
      });
      await espRef.current.main();
    } catch (e) {
      await disconnect();
      throw e;
    }
  };

  const disconnect = async () => {
    if (!espRef.current) return;

    const port = espRef.current.transport.device;
    serialLog.line("--- Resetting device ---");

    try {
      await sleep(100);
      await espRef.current.after("hard_reset");

      // Pulse EN via RTS for boards wired for auto-reset
      await espRef.current.transport.setDTR(false);
      await espRef.current.transport.setRTS(true);
      await sleep(100);
      await espRef.current.transport.setRTS(false);
    } catch (e) {
      serialLog.line(`--- Reboot failed: ${e} ---`);
    }
    serialLog.line(
      "--- Please turn the tracker off and on again (or press its reset button) to boot the new firmware ---",
    );

    const resume = resumeMonitorRef.current;
    try {
      await espRef.current.transport.disconnect();
    } catch (e) {
      serialLog.line(`--- Closing flasher connection failed: ${e} ---`);
    }

    espRef.current = null;

    if (resume) {
      resumeMonitorRef.current = false;
      serialLog.line("--- Reconnecting console ---");
      try {
        await resumeSerialMonitor(port);
      } catch (e) {
        serialLog.line(`--- Could not resume console: ${e} ---`);
      }
    }
  };

  const setWifi = async (
    ssid: string,
    password: string,
    onNotice?: (message: string | null) => void,
  ) => {
    if (!espRef.current) throw new Error("Connection not open");

    const serialOutput: string[] = [];
    await new Promise(async (resolve, reject) => {
      if (!espRef.current) return;

      let timedOut = false;
      let receivedAny = false;
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
            serialLog.line(line);

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
            receivedAny = true;
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
      serialLog.line("--- Resetting device ---");
      try {
        await esp.after("hard_reset");
        // The firmware talks at the console baud rate, not the flashing one
        if (esp.transport.baudrate !== CONSOLE_BAUD_RATE) {
          await esp.transport.changeBaudrate(CONSOLE_BAUD_RATE);
        }
      } catch (e) {
        console.warn("Reset failed:", e);
        serialLog.line(`Reset failed: ${e}`);
      }
      // Pulse EN via RTS for boards wired for auto-reset
      try {
        await esp.transport.setDTR(false);
        await esp.transport.setRTS(true);
        await sleep(100);
        await esp.transport.setRTS(false);
        serialLog.line("--- Reboot signal sent to the tracker ---");
      } catch (e) {
        console.warn("Hardware reset failed:", e);
        serialLog.line(`Hardware reset failed: ${e}`);
      }

      console.log("Waiting for ESP to boot...");
      await sleep(1500);
      receivedAny = esp.transport.inWaiting() > 0;
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
      serialLog.line(`--- Sending: SET WIFI "${ssid}" "****" ---`);
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
        serialLog.line("--- Resending WiFi command ---");
        sendCommand().catch(console.error);
      }, 3000);

      // Silence after the reset and the command means the board never rebooted
      const rebootCheck = setTimeout(() => {
        if (receivedAny || timedOut) return;
        const notice =
          "The tracker doesn't seem to have rebooted. Please turn it off and on, or press its reset button.";
        serialLog.line(`--- ${notice} ---`);
        onNotice?.(notice);
      }, 6000);

      console.log("Waiting for WiFi connection...");
      setTimeout(() => {
        timedOut = true;
        clearInterval(resend);
        clearTimeout(rebootCheck);
        reject(new SerialError("Timeout", serialOutput));
      }, 30000);
      try {
        resolve(await readerPromise);
      } catch (e) {
        reject(e);
        return;
      } finally {
        clearInterval(resend);
        clearTimeout(rebootCheck);
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
