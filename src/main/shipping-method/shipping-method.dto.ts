import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateShippingMethodDto {
    @IsString()
    @Length(1, 50)
    code!: string;

    @IsString()
    @Length(2, 100)
    name!: string;

    @IsString()
    @IsOptional()
    @Length(0, 500)
    description?: string;

    @IsNumber()
    @Min(0)
    cost!: number;

    @IsString()
    @Length(1, 50)
    estimatedDays!: string;
}

export class UpdateShippingMethodDto {
    @IsUUID()
    id!: string;

    @IsString()
    @IsOptional()
    @Length(1, 50)
    code?: string;

    @IsString()
    @IsOptional()
    @Length(2, 100)
    name?: string;

    @IsString()
    @IsOptional()
    @Length(0, 500)
    description?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    cost?: number;

    @IsString()
    @IsOptional()
    @Length(1, 50)
    estimatedDays?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
