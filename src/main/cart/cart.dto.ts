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

export class GuestTokenDto {
    @IsUUID()
    guestToken!: string;
}

export class AddToGuestCartDto extends AddToCartDto {
    @IsUUID()
    guestToken!: string;
}

export class MergeGuestCartDto {
    @IsUUID()
    guestToken!: string;
}

export class GuestCartItemParamsDto extends GuestTokenDto {
    @IsUUID()
    id!: string;
}
