import { ApiProperty } from "@nestjs/swagger";

export class DebugDTO {
  @ApiProperty({ default: true })
  public use6Axis: boolean = true;

  @ApiProperty({ default: true })
  public optimizeUpdates: boolean = true;

  @ApiProperty({ default: true })
  public complianceMode: boolean = true;

  @ApiProperty({ default: true })
  public bmi160UseTempcal: boolean = true;

  @ApiProperty({ default: false })
  public bmi160TempcalDebug: boolean = false;

  @ApiProperty({ default: false })
  public bmi160Debug: boolean = false;

  @ApiProperty({ default: true })
  public bmi160UseSenscal: boolean = true;
}
