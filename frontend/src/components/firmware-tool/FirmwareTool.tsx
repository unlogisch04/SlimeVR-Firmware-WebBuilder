import {
  Alert,
  Container,
  Link,
  Paper,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { ConfigurationForm } from "./ConfigurationForm";
import { ErrorPane } from "./ErrorPane";
import { FinishStep } from "./FinishStep";
import { ProgressStep } from "./ProgressStep";
import { useSerial } from "../../hooks/serial";
import { useFirmwareTool } from "../../hooks/firmware-tool";
import { useState } from "react";
import { useFirmwareControllerGetVersions } from "../../firmwareApi/firmwareComponents";

const steps = [
  "Configuration",
  "Building",
  "Downloading",
  "Flashing",
  "Setting WiFi",
  "Done",
];

const link = (href: string, text: string, prefix: string = "https://") => {
  return (
    <Link target="_blank" rel="noopener" href={`${prefix}${href}`}>
      {text}
    </Link>
  );
};
const ghLink = (
  owner: string,
  branch: string,
  repo: string = "SlimeVR-Tracker-ESP",
) => {
  return link(
    `github.com/${owner}/${repo}/tree/${branch}`,
    `${owner}/${branch}`,
  );
};

export function FirmwareTool() {
  const { serialSupported } = useSerial();
  const {
    flash,
    activeStep,
    error,
    buildConfig,
    form,
    statusValue,
    statusMessage,
    toConfig,
  } = useFirmwareTool();

  const doAnother = () => {
    flash();
  };

  const [saveZip, setSaveZip] = useState(false);

  const { data: releases, isLoading: releasesLoading } =
    useFirmwareControllerGetVersions({});

  return (
    <Container component="main" maxWidth="md" sx={{ my: 3 }}>
      {!serialSupported && (
        <Alert variant="filled" severity="error" sx={{ my: 2 }}>
          This Browser does not support the WebSerial API.
          <p>
            Please use a different browser. (Chrome, Microsoft Edge or Opera)
          </p>
        </Alert>
      )}
      <Alert variant="filled" severity="warning" sx={{ my: 2 }}>
        This is an experimental version of the SlimeVR Firmware Tool run by
        Butterscotch, so uptime, functionality, and performance is not
        guaranteed.
      </Alert>
      <Alert variant="outlined" severity="info" sx={{ my: 2 }}>
        <p>
          {link(
            "github.com/SlimeVR/SlimeVR-Tracker-ESP/releases",
            "SlimeVR/vX.X.X",
          )}{" "}
          - SlimeVR stable release(s)
        </p>
        {releasesLoading ? (
          <p>Loading branches...</p>
        ) : (
          releases
            ?.filter((r) => r.isBranch)
            ?.map((r) => (
              <p key={`${r.owner}/${r.repo}/${r.version}`}>
                <Link target="_blank" rel="noopener" href={r.url}>
                  {`${r.owner}/${r.version}`}
                </Link>{" "}
                - {r.description}
              </p>
            ))
        )}
      </Alert>
      <Alert variant="filled" severity="warning" sx={{ my: 2 }}>
        IMPORTANT: {ghLink("SlimeVR", "v0.3.3")} is now being redirected to{" "}
        {ghLink("ButterscotchV", "v0.3.3-bno-patched")}. Using BNOs with v0.3.3
        is still not recommended, but it should work with the patch. The
        original release can still be found on the SlimeVR repository.
      </Alert>
      <Paper
        variant="outlined"
        sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 3 } }}
      >
        <Typography component="h1" variant="h4" align="center">
          Configure your firmware
        </Typography>
        <Stepper
          activeStep={activeStep}
          sx={{ pt: 3, pb: 5 }}
          orientation="vertical"
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                {error && <ErrorPane error={error}></ErrorPane>}

                {!error && (
                  <>
                    {activeStep === 0 && (
                      <ConfigurationForm
                        form={form}
                        nextStep={buildConfig}
                        saveZip={saveZip}
                        setSaveZip={setSaveZip}
                      />
                    )}
                    {activeStep > 0 && activeStep < 5 && (
                      <ProgressStep
                        value={statusValue}
                        message={statusMessage}
                        showRickOption={activeStep === 3}
                      ></ProgressStep>
                    )}
                    {activeStep === 5 && (
                      <FinishStep
                        doAnother={doAnother}
                        toConfig={toConfig}
                        saveZip={saveZip}
                      />
                    )}
                  </>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </Container>
  );
}
