import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CartRepository } from './cart.repository';
import { randomUUID } from 'crypto';
import {
  AddToCartDto,
  AddToGuestCartDto,
  MergeGuestCartDto,
  UpdateCartItemDto,
} from './cart.dto';

type CartMergeConflict = {
  variantId: string;
  requestedQuantity: number;
  finalQuantity: number;
  reason: 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'VARIANT_NOT_FOUND';
  message: string;
};

@Injectable()
export class CartService {
  constructor(private readonly cartRepository: CartRepository) {}

  // ------------------------------- Get My Cart Items -------------------------------
  public async getMyCartItems(userId: string) {
    const cart = await this.cartRepository.findOrCreateCart(userId);
    return cart;
  }

  // ------------------------------- Add to Cart -------------------------------
  public async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const { variantId, quantity } = addToCartDto;

    // Check if variant exists
    const variant = await this.cartRepository.findVariantById(variantId);

    if (!variant) {
      throw new HttpException(
        'Product variant not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if variant has enough stock
    if (variant.stockQuantity < quantity) {
      throw new HttpException(
        `Insufficient stock. Only ${variant.stockQuantity} items available`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get or create cart
    const cart = await this.cartRepository.findOrCreateCart(userId);

    // Check if item already exists in cart
    const existingCartItem = await this.cartRepository.findCartItem(
      cart.id,
      variantId,
    );

    if (existingCartItem) {
      // Update quantity if item already exists
      const newQuantity = existingCartItem.quantity + quantity;

      // Check stock for new quantity
      if (variant.stockQuantity < newQuantity) {
        throw new HttpException(
          `Insufficient stock. Only ${variant.stockQuantity} items available`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatedItem = await this.cartRepository.updateCartItemQuantity(
        existingCartItem.id,
        newQuantity,
      );

      return updatedItem;
    }

    // Add new item to cart
    const cartItem = await this.cartRepository.addCartItem(
      cart.id,
      variantId,
      quantity,
    );

    return cartItem;
  }

  // ------------------------------- Create Guest Token -------------------------------
  public createGuestToken() {
    return {
      guestToken: randomUUID(),
    };
  }

  // ------------------------------- Get Guest Cart Items -------------------------------
  public async getGuestCartItems(guestToken: string) {
    return this.cartRepository.findOrCreateGuestCart(guestToken);
  }

  // ------------------------------- Add to Guest Cart -------------------------------
  public async addToGuestCart(addToGuestCartDto: AddToGuestCartDto) {
    const { guestToken, variantId, quantity } = addToGuestCartDto;

    const variant = await this.cartRepository.findVariantById(variantId);

    if (!variant) {
      throw new HttpException(
        'Product variant not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const guestCart =
      await this.cartRepository.findOrCreateGuestCart(guestToken);
    const existingCartItem = guestCart.items.find(
      (item) => item.variantId === variantId,
    );
    const newQuantity = (existingCartItem?.quantity ?? 0) + quantity;

    if (variant.stockQuantity < newQuantity) {
      throw new HttpException(
        `Insufficient stock. Only ${variant.stockQuantity} items available`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.cartRepository.addGuestCartItem(
      guestCart.id,
      variantId,
      quantity,
    );
  }

  // ------------------------------- Update Cart Item Quantity -------------------------------
  public async updateCartItemQuantity(
    userId: string,
    cartItemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ) {
    const { quantity } = updateCartItemDto;

    // Check if cart item exists
    const cartItem = await this.cartRepository.findCartItemById(cartItemId);

    if (!cartItem) {
      throw new HttpException('Cart item not found', HttpStatus.NOT_FOUND);
    }

    // Get customer to verify ownership
    const customer = await this.cartRepository.getCustomerByUserId(userId);

    // Verify the cart belongs to the customer
    if (cartItem.cart.customerId !== customer.id) {
      throw new HttpException(
        'Unauthorized to update this cart item',
        HttpStatus.FORBIDDEN,
      );
    }

    // Check variant stock
    const variant = await this.cartRepository.findVariantById(
      cartItem.variantId,
    );

    if (!variant) {
      throw new HttpException(
        'Product variant not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (variant.stockQuantity < quantity) {
      throw new HttpException(
        `Insufficient stock. Only ${variant.stockQuantity} items available`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedItem = await this.cartRepository.updateCartItemQuantity(
      cartItemId,
      quantity,
    );

    return updatedItem;
  }

  // ------------------------------- Update Guest Cart Item Quantity -------------------------------
  public async updateGuestCartItemQuantity(
    guestToken: string,
    guestCartItemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ) {
    const { quantity } = updateCartItemDto;

    const cartItem =
      await this.cartRepository.findGuestCartItemById(guestCartItemId);

    if (!cartItem) {
      throw new HttpException('Guest cart item not found', HttpStatus.NOT_FOUND);
    }

    if (cartItem.guestCart.guestToken !== guestToken) {
      throw new HttpException(
        'Unauthorized to update this guest cart item',
        HttpStatus.FORBIDDEN,
      );
    }

    const variant = await this.cartRepository.findVariantById(
      cartItem.variantId,
    );

    if (!variant) {
      throw new HttpException(
        'Product variant not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (variant.stockQuantity < quantity) {
      throw new HttpException(
        `Insufficient stock. Only ${variant.stockQuantity} items available`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.cartRepository.updateGuestCartItemQuantity(
      guestCartItemId,
      quantity,
    );
  }

  // ------------------------------- Delete Cart Item -------------------------------
  public async deleteCartItem(userId: string, cartItemId: string) {
    // Check if cart item exists
    const cartItem = await this.cartRepository.findCartItemById(cartItemId);

    if (!cartItem) {
      throw new HttpException('Cart item not found', HttpStatus.NOT_FOUND);
    }

    // Get customer to verify ownership
    const customer = await this.cartRepository.getCustomerByUserId(userId);

    // Verify the cart belongs to the customer
    if (cartItem.cart.customerId !== customer.id) {
      throw new HttpException(
        'Unauthorized to delete this cart item',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.cartRepository.deleteCartItem(cartItemId);
    return { message: 'Cart item deleted successfully' };
  }

  // ------------------------------- Delete Guest Cart Item -------------------------------
  public async deleteGuestCartItem(
    guestToken: string,
    guestCartItemId: string,
  ) {
    const cartItem =
      await this.cartRepository.findGuestCartItemById(guestCartItemId);

    if (!cartItem) {
      throw new HttpException('Guest cart item not found', HttpStatus.NOT_FOUND);
    }

    if (cartItem.guestCart.guestToken !== guestToken) {
      throw new HttpException(
        'Unauthorized to delete this guest cart item',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.cartRepository.deleteGuestCartItem(guestCartItemId);
    return { message: 'Guest cart item deleted successfully' };
  }

  // ------------------------------- Merge Guest Cart -------------------------------
  public async mergeGuestCart(userId: string, payload: MergeGuestCartDto) {
    const userCart = await this.cartRepository.findOrCreateCart(userId);
    const guestCart = await this.cartRepository.findGuestCartByToken(
      payload.guestToken,
    );

    if (!guestCart) {
      return {
        cart: userCart,
        conflicts: [],
        merged: false,
      };
    }

    const requestedQuantityByVariant = new Map<string, number>();

    for (const item of userCart.items) {
      requestedQuantityByVariant.set(item.variantId, item.quantity);
    }

    for (const item of guestCart.items) {
      const existingQuantity =
        requestedQuantityByVariant.get(item.variantId) ?? 0;
      requestedQuantityByVariant.set(
        item.variantId,
        Math.max(existingQuantity, item.quantity),
      );
    }

    const variantIds = [...requestedQuantityByVariant.keys()];
    const variants = await this.cartRepository.findVariantsByIds(variantIds);
    const variantById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );
    const conflicts: CartMergeConflict[] = [];
    const finalItems: { variantId: string; quantity: number }[] = [];

    for (const [variantId, requestedQuantity] of requestedQuantityByVariant) {
      const variant = variantById.get(variantId);

      if (!variant) {
        conflicts.push({
          variantId,
          requestedQuantity,
          finalQuantity: 0,
          reason: 'VARIANT_NOT_FOUND',
          message: 'Product variant no longer exists and was removed.',
        });
        continue;
      }

      if (variant.stockQuantity <= 0) {
        conflicts.push({
          variantId,
          requestedQuantity,
          finalQuantity: 0,
          reason: 'OUT_OF_STOCK',
          message: 'Product variant is out of stock and was removed.',
        });
        continue;
      }

      const finalQuantity = Math.min(requestedQuantity, variant.stockQuantity);

      if (finalQuantity < requestedQuantity) {
        conflicts.push({
          variantId,
          requestedQuantity,
          finalQuantity,
          reason: 'INSUFFICIENT_STOCK',
          message: `Quantity was reduced to available stock (${variant.stockQuantity}).`,
        });
      }

      finalItems.push({
        variantId,
        quantity: finalQuantity,
      });
    }

    const cart = await this.cartRepository.replaceUserCartAndDeleteGuestCart(
      userCart.id,
      guestCart.id,
      finalItems,
    );

    return {
      cart,
      conflicts,
      merged: true,
    };
  }
}
