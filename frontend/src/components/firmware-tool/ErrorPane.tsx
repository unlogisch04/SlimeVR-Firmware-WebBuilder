import { ExpandMore } from "@mui/icons-material";
import {
  Button,
  Card,
  CardContent,
  Collapse,
  Grid,
  Typography,
} from "@mui/material";
import { Box } from "@mui/system";
import { useState } from "react";

export type ErrorMessage = {
  title: string;
  message: string;
  action?: () => void;
  actionText?: string;
  consoleOutput?: string;
};

export function ErrorPane({ error }: { error: ErrorMessage }) {
  const [expanded, setExpanded] = useState(false);

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
            <Card variant="outlined" sx={{ mt: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Hide output" : "Show output"}
                <ExpandMore
                  sx={{
                    ml: 0.5,
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                />
              </Button>
              <Collapse in={expanded}>
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
              </Collapse>
            </Card>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
