import {
  IsString,
  IsEmail,
  Length,
  IsOptional,
  IsInt,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Gender, UserStatus } from 'src/generated/prisma';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 50)
  name!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  password!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  profile_photo?: string;

  @IsOptional()
  @IsInt()
  streetNumber?: number;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsInt()
  postalCode?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  countryId?: string;

  @IsOptional()
  @IsString()
  stateId?: string;
}

export class ChangeUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class CreateOrUpdateUserAddressDto {
  @IsString()
  thanaId!: string;

  @IsInt()
  postalCode!: number;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;
}
