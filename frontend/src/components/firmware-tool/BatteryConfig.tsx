import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Controller } from "react-hook-form";
import { HelperComponent } from "../HelperComponent";
import { useFirmwareControllerGetBatteriesTypes } from "../../firmwareApi/firmwareComponents";

export function BatteryConfig({
  control,
  errors,
}: {
  control: any;
  errors: any;
}) {
  const { data: batteries, isLoading: batteriesLoading } =
    useFirmwareControllerGetBatteriesTypes({});

  return (
    <Accordion variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          Battery Sense (Optional)
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth>
              <Controller
                name={"battery.type"}
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <>
                    <InputLabel id="battery-label">Battery Type</InputLabel>
                    <Select
                      labelId="battery-label"
                      label="Battery Type"
                      value={batteriesLoading ? "loading" : value || "none"}
                      onChange={onChange}
                      error={!!errors.battery?.type}
                    >
                      {batteriesLoading && (
                        <MenuItem value="loading" disabled>
                          Loading
                        </MenuItem>
                      )}
                      <MenuItem value="none" disabled>
                        Please select the battery type
                      </MenuItem>
                      {!batteriesLoading &&
                        batteries &&
                        batteries!.map((item) => (
                          <MenuItem key={item} value={item}>
                            {item}
                          </MenuItem>
                        ))}
                    </Select>
                    <HelperComponent
                      text="Battery Type configuration (Usually BAT_EXTERNAL)"
                      link="https://docs.slimevr.dev/firmware/configuring-project.html#set-battery-monitoring-options"
                    />
                  </>
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth>
              <Controller
                name={"battery.resistance"}
                control={control}
                rules={{ required: true, min: 0 }}
                render={({ field: { onChange, value } }) => (
                  <TextField
                    error={!!errors.battery?.resistance}
                    onChange={onChange}
                    value={value ?? ""}
                    label={"Battery Shield Resistance (kOhm)"}
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth>
              <Controller
                name={"battery.r1"}
                control={control}
                rules={{ required: true, min: 0 }}
                render={({ field: { onChange, value } }) => (
                  <TextField
                    error={!!errors.battery?.r1}
                    onChange={onChange}
                    value={value ?? ""}
                    label={"Battery Shield R1 (kOhm)"}
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth>
              <Controller
                name={"battery.r2"}
                control={control}
                rules={{ required: true, min: 0 }}
                render={({ field: { onChange, value } }) => (
                  <TextField
                    error={!!errors.battery?.r2}
                    onChange={onChange}
                    value={value ?? ""}
                    label={"Battery Shield R2 (kOhm)"}
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth>
              <Controller
                name={"battery.pin"}
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <TextField
                    error={!!errors.battery?.pin}
                    onChange={onChange}
                    value={value || ""}
                    label={"Battery Sense Pin"}
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
