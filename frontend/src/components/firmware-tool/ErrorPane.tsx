import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export type ErrorMessage = {
  title: string;
  message: string;
  action?: () => void;
  actionText?: string;
  consoleOutput?: string;
};

export function ErrorPane({ error }: { error: ErrorMessage }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ width: "100%" }}>
          <Typography
            variant="h4"
            color="inherit"
            noWrap
            sx={{
              mb: 2,
              textAlign: "center",
            }}
          >
            {error.title}
          </Typography>
          <Typography
            variant="body1"
            color="inherit"
            sx={{
              mb: 2,
              textAlign: "center",
            }}
          >
            {error.message}
          </Typography>
          {error.action && error.actionText && (
            <Grid
              container
              sx={{
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Grid
                size={{
                  xs: 12,
                  sm: 4,
                }}
              >
                <Button
                  color="primary"
                  fullWidth
                  variant="contained"
                  onClick={error.action}
                >
                  {error.actionText}
                </Button>
              </Grid>
            </Grid>
          )}
          {error.consoleOutput && (
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                Console Output
              </AccordionSummary>
              <AccordionDetails>
                <Divider sx={{ mb: 0.5 }} />
                <Typography
                  variant="body1"
                  color="inherit"
                  sx={{
                    textAlign: "left",
                    fontFamily: "monospace",
                    padding: 1,
                    whiteSpace: "pre-line",
                  }}
                >
                  {error.consoleOutput}
                </Typography>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
