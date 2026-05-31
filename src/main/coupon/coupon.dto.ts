import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Min,
    ValidateNested,
} from 'class-validator';
import { CouponType } from 'src/generated/prisma';

export class CreateCouponDto {
    @IsString()
    @Length(2, 50)
    code!: string;

    @IsString()
    @Length(2, 120)
    name!: string;

    @IsOptional()
    @IsString()
    @Length(0, 500)
    description?: string;

    @IsOptional()
    @IsEnum(CouponType)
    type?: CouponType;

    @IsNumber()
    @Min(0)
    value!: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minOrderAmount?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    maxDiscountAmount?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    usageLimit?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    userUsageLimit?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    startsAt?: string;

    @IsOptional()
    @IsString()
    expiresAt?: string;

    @IsOptional()
    @IsArray()
    @IsUUID(undefined, { each: true })
    applicableProductIds?: string[];
}

export class UpdateCouponDto {
    @IsUUID()
    id!: string;

    @IsOptional()
    @IsString()
    @Length(2, 50)
    code?: string;

    @IsOptional()
    @IsString()
    @Length(2, 120)
    name?: string;

    @IsOptional()
    @IsString()
    @Length(0, 500)
    description?: string;

    @IsOptional()
    @IsEnum(CouponType)
    type?: CouponType;

    @IsOptional()
    @IsNumber()
    @Min(0)
    value?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minOrderAmount?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    maxDiscountAmount?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    usageLimit?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    userUsageLimit?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    startsAt?: string;

    @IsOptional()
    @IsString()
    expiresAt?: string;

    @IsOptional()
    @IsArray()
    @IsUUID(undefined, { each: true })
    applicableProductIds?: string[];
}

export class CouponVariantDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ValidateCouponDto {
  @IsString()
  @Length(2, 50)
  code!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CouponVariantDto)
  variants!: CouponVariantDto[];
}

export class SetCouponActiveDto {
    @IsBoolean()
    isActive!: boolean;
}
