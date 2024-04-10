import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Controller } from "react-hook-form";
import { useSerial } from "../../hooks/serial";
import { ImuConfig } from "./ImuConfig";
import { BatteryConfig } from "./BatteryConfig";
import { WiFiConfig } from "./WiFiConfig";
import {
  fetchFirmwareControllerGetDefaultConfig,
  useFirmwareControllerGetBoardsTypes,
  useFirmwareControllerGetIMUSTypes,
  useFirmwareControllerGetVersions,
} from "../../firmwareApi/firmwareComponents";
import { BuildResponse, Imudto } from "../../firmwareApi/firmwareSchemas";
import {
  defaultFormValues,
  fillMissingValues,
} from "../../hooks/firmware-tool";

export function ConfigurationForm({
  form,
  nextStep,
  saveZip,
  setSaveZip,
}: {
  form: any;
  nextStep: (id: BuildResponse, saveZip: boolean) => void;
  saveZip: boolean;
  setSaveZip: (value: boolean) => void;
}) {
  const { serialSupported } = useSerial();
  const { handleSubmit, formState, control, watch, reset } = form;

  const version = watch("version");
  const wifi = watch("wifi");
  const enableLed = watch("board.enableLed");

  const { errors } = formState;
  const { data: releases, isLoading: releasesLoading } =
    useFirmwareControllerGetVersions({});

  const { data: boards, isLoading: boardsLoading } =
    useFirmwareControllerGetBoardsTypes({});

  const { data: imus, isLoading: imusLoading } =
    useFirmwareControllerGetIMUSTypes({});

  const onBoardChange = (event: any) => {
    const boardType = event.target.value;

    if (boardType) {
      fetchFirmwareControllerGetDefaultConfig({
        pathParams: { board: boardType },
      }).then((data) => {
        if (!data) return;
        const build = data as any;

        build.version = version;
        build.wifi = wifi;

        reset(fillMissingValues(build, defaultFormValues));
      });
    }
  };

  // useEffect(() => {

  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [boardType])

  const onSubmit = (data: any) => {
    data.imus = data.imus
      .filter(({ enabled }: { enabled: boolean }) => !!enabled)
      .map(({ enabled, ...imu }: any) => ({ ...imu }));
    nextStep(data, saveZip);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={12}>
          <FormControl fullWidth>
            {
              <Controller
                name={"version"}
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <>
                    <InputLabel id="version-label">Firmware Version</InputLabel>
                    <Select
                      labelId="version-label"
                      label="Firmware Version"
                      value={releasesLoading ? "loading" : value || "none"}
                      error={!!errors.version}
                      onChange={onChange}
                    >
                      {releasesLoading && (
                        <MenuItem value="loading" disabled>
                          Loading
                        </MenuItem>
                      )}
                      <MenuItem value="none" disabled>
                        Please select the firmware version
                      </MenuItem>
                      {!releasesLoading &&
                        releases?.map((item) => (
                          <MenuItem key={item.name} value={item.name}>
                            {item.name}
                          </MenuItem>
                        ))}
                    </Select>
                  </>
                )}
              />
            }
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={12}>
          <FormControl fullWidth>
            <Controller
              name={"board.type"}
              control={control}
              rules={{ required: true }}
              render={({ field: { onChange, value } }) => (
                <>
                  <InputLabel id="board-label">Board</InputLabel>
                  <Select
                    labelId="board-label"
                    label="Board"
                    value={boardsLoading ? "loading" : value || "none"}
                    onChange={(event) => {
                      onBoardChange(event);
                      onChange(event);
                    }}
                    error={!!errors.board?.type}
                  >
                    {boardsLoading && (
                      <MenuItem value="loading" disabled>
                        Loading
                      </MenuItem>
                    )}
                    <MenuItem value="none" disabled>
                      Please select the board
                    </MenuItem>
                    {!boardsLoading &&
                      boards?.map((board) => (
                        <MenuItem key={board.boardType} value={board.boardType}>
                          {board.boardType}
                        </MenuItem>
                      ))}
                  </Select>
                </>
              )}
            />
          </FormControl>
          <Accordion variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Advanced options</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <Controller
                      name={"board.pins.imuSDA"}
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <TextField
                          onChange={onChange}
                          value={value || ""}
                          label={"SDA Pin"}
                        />
                      )}
                    />
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <Controller
                      name={"board.pins.imuSCL"}
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <TextField
                          onChange={onChange}
                          value={value || ""}
                          label={"SCL Pin"}
                        />
                      )}
                    />
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <Controller
                      name={"board.enableLed"}
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <FormControlLabel
                          control={
                            <Checkbox onChange={onChange} checked={value} />
                          }
                          label="Enable LED"
                        />
                      )}
                    />
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <Controller
                      name={"board.pins.led"}
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <TextField
                          onChange={onChange}
                          value={value || ""}
                          disabled={!enableLed}
                          label={"Led Pin"}
                        />
                      )}
                    />
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <Controller
                      name={"board.ledInverted"}
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <FormControlLabel
                          control={
                            <Checkbox onChange={onChange} checked={value} />
                          }
                          label="LED Inverted"
                        />
                      )}
                    />
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <Controller
                      name={"swapAddresses"}
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <FormControlLabel
                          control={
                            <Checkbox onChange={onChange} checked={value} />
                          }
                          label="Swap IMU Addresses"
                        />
                      )}
                    />
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
          <Grid item xs={12} sm={12} mt={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <ImuConfig
                  watch={watch}
                  control={control}
                  imuIndex={0}
                  errors={errors}
                  name={"Primary IMU"}
                  forced
                  imus={imus as Imudto[]}
                  imusLoading={imusLoading}
                ></ImuConfig>
              </Grid>
              <Grid item xs={12} sm={6}>
                <ImuConfig
                  watch={watch}
                  control={control}
                  imuIndex={1}
                  errors={errors}
                  name={"Secondary IMU"}
                  forced={false}
                  imus={imus as Imudto[]}
                  imusLoading={imusLoading}
                ></ImuConfig>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12} sm={12}>
          <BatteryConfig control={control} errors={errors}></BatteryConfig>
        </Grid>
        <Grid item xs={12} sm={12}>
          <WiFiConfig errors={errors} control={control}></WiFiConfig>
        </Grid>
        <Grid item xs={12} sm={12}>
          <Button
            variant="contained"
            type="submit"
            disabled={!serialSupported}
            sx={{ mr: 2 }}
            onClick={() => {
              setSaveZip(false);
            }}
          >
            Flash to device
          </Button>
          <Button
            variant="contained"
            type="submit"
            onClick={() => {
              setSaveZip(true);
            }}
          >
            Download as ZIP
          </Button>
        </Grid>
      </Grid>
    </form>
  );
}
