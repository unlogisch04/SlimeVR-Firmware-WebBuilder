import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Controller } from "react-hook-form";

export function DebugConfig({
  control,
  errors,
}: {
  control: any;
  errors: any;
}) {
  return (
    <Accordion variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          Debug Settings (optional)
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <Controller
                name={"debug.use6Axis"}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox onChange={onChange} checked={value} />}
                    label="Use 6 Axis"
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <Controller
                name={"debug.optimizeUpdates"}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox onChange={onChange} checked={value} />}
                    label="Optimize Updates"
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <Controller
                name={"debug.complianceMode"}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox onChange={onChange} checked={value} />}
                    label="Compliance Mode"
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <Controller
                name={"debug.bmi160UseTempcal"}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox onChange={onChange} checked={value} />}
                    label="BMI160 Use Tempcal"
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <Controller
                name={"debug.bmi160TempcalDebug"}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox onChange={onChange} checked={value} />}
                    label="BMI160 Tempcal Debug"
                  />
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <Controller
                name={"debug.bmi160UseSenscal"}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox onChange={onChange} checked={value} />}
                    label="BMI160 Use Senscal"
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
