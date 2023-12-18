import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  FormControl,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Controller } from "react-hook-form";

export function WifiConfig({ control, errors }: { control: any; errors: any }) {
  return (
    <Accordion variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          WiFi Settings (optional)
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={12}>
            <Alert severity="info">
              For your safety, the WiFi settings are set on the client side
              after the flashing.
              <p>
                <b>Your WiFi credentials will not be saved.</b>
              </p>
            </Alert>
          </Grid>
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth>
              <Controller
                name={"wifi.ssid"}
                control={control}
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
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth>
              <Controller
                name={"wifi.password"}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TextField
                    error={!!errors.wifi?.password}
                    onChange={onChange}
                    value={value || ""}
                    label={"WiFi Password"}
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
