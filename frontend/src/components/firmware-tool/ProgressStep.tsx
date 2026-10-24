import {
  Box,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Typography,
} from "@mui/material";

export function ProgressStep({
  value,
  message,
}: {
  value: number | null;
  message: string;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ width: "100%" }}>
          <Typography
            variant="h5"
            color="inherit"
            sx={{
              mb: 2,
              textAlign: "center",
            }}
          >
            {message}
          </Typography>

          <Grid container spacing={2}>
            <Grid size={12}>
              <LinearProgress
                variant={value === null ? "indeterminate" : "determinate"}
                value={value || 0}
              />
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
}
