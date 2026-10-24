import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useEffect, useRef, useState } from "react";
import { serialLog, useSerialLog } from "../../hooks/serial-log";
import { useSerialMonitor } from "../../hooks/serial-monitor";

const SPACE_WARNING =
  "Has leading or trailing spaces - make sure this is intended";

export function SerialConsole({
  serialSupported,
  large = false,
}: {
  serialSupported: boolean;
  large?: boolean;
}) {
  const lines = useSerialLog();
  const {
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
  } = useSerialMonitor();
  const [wifiOpen, setWifiOpen] = useState(false);
  const [wifiBase64, setWifiBase64] = useState(false);
  const [ssid, setSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [factoryResetOpen, setFactoryResetOpen] = useState(false);
  const [input, setInput] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lines]);

  const handleConnect = () => {
    connect().catch((e) => serialLog.line(`--- Could not connect: ${e} ---`));
  };

  const handleSetWifi = () => {
    if (!ssid) return;
    void setWifi(ssid, wifiPassword, wifiBase64);
    setWifiOpen(false);
    setWifiPassword("");
    setShowPassword(false);
  };

  const handleSend = () => {
    if (!connected) return;
    void send(input);
    setInput("");
  };

  return (
    <Paper variant="outlined" sx={{ mb: 3, p: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          mb: 1,
        }}
      >
        <Typography variant="h6" component="h2">
          Serial console
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" onClick={() => serialLog.clear()}>
            Clear
          </Button>
          {connected ? (
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => void disconnect()}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              disabled={!serialSupported}
              onClick={handleConnect}
            >
              Connect
            </Button>
          )}
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
        <Button
          size="small"
          disabled={!connected}
          variant="outlined"
          onClick={() => void getInfo()}
        >
          Get info
        </Button>
        <Button
          size="small"
          disabled={!connected}
          variant="outlined"
          onClick={() => void getConfig()}
        >
          Get config
        </Button>
        <Button
          size="small"
          disabled={!connected}
          variant="outlined"
          onClick={() => void wifiScan()}
        >
          WiFi scan
        </Button>
        <Button
          size="small"
          disabled={!connected}
          variant="outlined"
          onClick={() => setWifiOpen(true)}
        >
          Set WiFi
        </Button>
        <Button
          size="small"
          disabled={!connected}
          variant="outlined"
          onClick={() => void reboot()}
        >
          Reboot
        </Button>
        <Button
          size="small"
          disabled={!connected}
          variant="outlined"
          color="warning"
          onClick={() => setFactoryResetOpen(true)}
        >
          Factory reset
        </Button>
      </Box>
      <Dialog
        open={wifiOpen}
        onClose={() => setWifiOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSetWifi();
          }}
        >
          <DialogTitle>Set WiFi credentials</DialogTitle>
          <DialogContent
            sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
          >
            <TextField
              label="WiFi SSID"
              error={ssid !== ssid.trim()}
              value={ssid}
              autoFocus
              margin="dense"
              onChange={(e) => setSsid(e.target.value)}
              helperText={ssid !== ssid.trim() ? SPACE_WARNING : undefined}
            />
            <TextField
              label="WiFi Password"
              error={wifiPassword !== wifiPassword.trim()}
              value={wifiPassword}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              onChange={(e) => setWifiPassword(e.target.value)}
              helperText={
                wifiPassword !== wifiPassword.trim() ? SPACE_WARNING : undefined
              }
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword((v) => !v)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                      >
                        {showPassword ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={wifiBase64}
                  onChange={(e) => setWifiBase64(e.target.checked)}
                />
              }
              label="Send base64 encoded (SET BWIFI) - for special characters like quotes"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWifiOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!ssid}>
              Send
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={factoryResetOpen}
        onClose={() => setFactoryResetOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Factory reset the tracker?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This erases the tracker's settings, including its WiFi credentials
            and calibration. This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFactoryResetOpen(false)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => {
              setFactoryResetOpen(false);
              void factoryReset();
            }}
          >
            Factory reset
          </Button>
        </DialogActions>
      </Dialog>
      <Box
        ref={boxRef}
        component="pre"
        sx={{
          m: 0,
          p: 1,
          height: large ? "70vh" : 240,
          overflow: "auto",
          bgcolor: "background.default",
          border: 1,
          borderColor: "divider",
          color: (theme) =>
            theme.palette.mode === "dark" ? "#ddd" : theme.palette.text.primary,
          fontFamily: "monospace",
          fontSize: 12,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {lines.join("\n")}
        {serialLog.partial && `${lines.length ? "\n" : ""}${serialLog.partial}`}
      </Box>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        sx={{ display: "flex", gap: 1, mt: 1 }}
      >
        <TextField
          size="small"
          fullWidth
          placeholder={connected ? "Send text to the device" : "Not connected"}
          value={input}
          disabled={!connected}
          onChange={(e) => setInput(e.target.value)}
          slotProps={{ htmlInput: { autoComplete: "off" } }}
        />
        <Button type="submit" variant="contained" disabled={!connected}>
          Send
        </Button>
      </Box>
    </Paper>
  );
}
