import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useState } from "react";
import { Controller } from "react-hook-form";

export function WiFiConfig({ control, errors }: { control: any; errors: any }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Accordion variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          gutterBottom
          sx={{
            color: "text.secondary",
            fontSize: 14,
          }}
        >
          WiFi Settings (optional)
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={3}>
          <Grid
            size={{
              xs: 12,
              sm: 12,
            }}
          >
            <Alert severity="info">
              For your safety, the WiFi settings are set on the client side
              after the flashing.
              <p>
                <b>Your WiFi credentials will not be saved.</b>
              </p>
            </Alert>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
            }}
          >
            <FormControl fullWidth>
              <Controller
                name={"wifi.ssid"}
                control={control}
                rules={{
                  maxLength: 32,
                }}
                render={({ field: { onChange, value } }) => (
                  <TextField
                    error={!!errors.wifi?.ssid}
                    onChange={onChange}
                    value={value || ""}
                    label={"WiFi SSID"}
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
            }}
          >
            <FormControl fullWidth>
              <Controller
                name={"wifi.password"}
                control={control}
                rules={{
                  validate: (s: string) => {
                    return !s || (s.length >= 8 && s.length <= 63);
                  },
                }}
                render={({ field: { onChange, value } }) => (
                  <TextField
                    error={!!errors.wifi?.password}
                    onChange={onChange}
                    value={value || ""}
                    label={"WiFi Password"}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
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
                )}
              />
            </FormControl>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
}
