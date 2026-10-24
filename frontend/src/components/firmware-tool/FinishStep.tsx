import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
} from "@mui/material";

export function FinishStep({
  doAnother,
  toConfig,
  saveZip,
}: {
  doAnother: () => void;
  toConfig: () => void;
  saveZip: boolean;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ width: "100%" }}>
          <Typography
            variant="h5"
            color="inherit"
            noWrap
            sx={{
              mb: 2,
              textAlign: "center",
            }}
          >
            {saveZip
              ? "Firmware downloaded!"
              : "Firmware uploaded. Your tracker is set up!"}
          </Typography>
          <Grid
            container
            spacing={2}
            sx={{
              justifyContent: "center",
            }}
          >
            <Grid
              size={{
                xs: 12,
                sm: 4,
              }}
            >
              <Button fullWidth variant="contained" onClick={doAnother}>
                {saveZip ? "Flash to device" : "Flash another one"}
              </Button>
            </Grid>
            <Grid
              size={{
                xs: 12,
                sm: 4,
              }}
            >
              <Button fullWidth onClick={toConfig}>
                Go to config
              </Button>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
}
