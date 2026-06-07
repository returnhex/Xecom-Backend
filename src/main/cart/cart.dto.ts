import { IsUUID, IsInt, Min } from 'class-validator';

export class AddToCartDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  quantity!: number;
}

// DTOs for guest cart operations

export class GuestTokenDto {
  @IsUUID()
  guestToken!: string;
}

export class AddToGuestCartDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsUUID()
  guestToken!: string;
}

export class MergeGuestCartDto {
  @IsUUID()
  guestToken!: string;
}

export class GuestCartItemParamsDto {
  @IsUUID()
  guestToken!: string;

  @IsUUID()
  id!: string;
}
