import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box } from "@mui/system";

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
            mb={2}
            variant="h4"
            color="inherit"
            textAlign="center"
            noWrap
          >
            {error.title}
          </Typography>
          <Typography mb={2} variant="body1" color="inherit" textAlign="center">
            {error.message}
          </Typography>
          {error.action && error.actionText && (
            <Grid container justifyContent="center" alignItems="center">
              <Grid item xs={12} sm={4}>
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
                  textAlign="left"
                  fontFamily="monospace"
                  padding={1}
                  whiteSpace="pre-line"
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
