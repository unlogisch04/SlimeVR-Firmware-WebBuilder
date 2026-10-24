import { InfoOutlined } from "@mui/icons-material";
import { Grid, Link } from "@mui/material";

export function HelperComponent({
  link,
  text,
}: {
  link: string;
  text: string;
}) {
  return (
    <Grid
      container
      sx={{
        mt: 1,
        flexDirection: "row",
        alignContent: "center",
      }}
    >
      <Grid
        sx={{
          mx: 0.5,
        }}
      >
        <InfoOutlined sx={{ verticalAlign: "middle" }} fontSize="small" />
      </Grid>
      <Grid
        sx={{
          justifySelf: "center",
        }}
      >
        <Link
          sx={{ fontSize: 12 }}
          href={link}
          target="_blank"
          rel="noreferrer"
        >
          {text}
        </Link>
      </Grid>
    </Grid>
  );
}
