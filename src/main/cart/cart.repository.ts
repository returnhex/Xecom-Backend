import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly cartInclude = {
    items: {
      include: {
        variant: {
          include: {
            product: {
              include: {
                images: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            attributes: {
              include: {
                attributeValue: {
                  include: {
                    attribute: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  private readonly guestCartInclude = {
    items: {
      include: {
        variant: {
          include: {
            product: {
              include: {
                images: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            attributes: {
              include: {
                attributeValue: {
                  include: {
                    attribute: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  async getCustomerByUserId(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new Error('Customer not found. Please complete your profile.');
    }

    return customer;
  }

  async findOrCreateCart(userId: string) {
    // First, get the customer
    const customer = await this.getCustomerByUserId(userId);

    let cart = await this.prisma.cart.findUnique({
      where: { customerId: customer.id },
      include: this.cartInclude,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { customerId: customer.id },
        include: this.cartInclude,
      });
    }

    return cart;
  }

  async findCartById(cartId: string) {
    return this.prisma.cart.findUnique({
      where: { id: cartId },
      include: this.cartInclude,
    });
  }

  async findCartItem(cartId: string, variantId: string) {
    return this.prisma.cartItem.findFirst({
      where: {
        cartId,
        variantId,
      },
    });
  }

  async addCartItem(cartId: string, variantId: string, quantity: number) {
    return this.prisma.cartItem.upsert({
      where: {
        cartId_variantId: {
          cartId,
          variantId,
        },
      },
      create: {
        cartId,
        variantId,
        quantity,
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
    });
  }

  async updateCartItemQuantity(cartItemId: string, quantity: number) {
    return this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });
  }

  async deleteCartItem(cartItemId: string) {
    return this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });
  }

  async findCartItemById(cartItemId: string) {
    return this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
      },
    });
  }

  async findVariantById(variantId: string) {
    return this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
  }

  async findVariantsByIds(variantIds: string[]) {
    return this.prisma.productVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
      },
    });
  }

  async findOrCreateGuestCart(guestToken: string) {
    return this.prisma.guestCart.upsert({
      where: { guestToken },
      create: { guestToken },
      update: {},
      include: this.guestCartInclude,
    });
  }

  async findGuestCartByToken(guestToken: string) {
    return this.prisma.guestCart.findUnique({
      where: { guestToken },
      include: this.guestCartInclude,
    });
  }

  async addGuestCartItem(
    guestCartId: string,
    variantId: string,
    quantity: number,
  ) {
    return this.prisma.guestCartItem.upsert({
      where: {
        guestCartId_variantId: {
          guestCartId,
          variantId,
        },
      },
      create: {
        guestCartId,
        variantId,
        quantity,
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
    });
  }

  async findGuestCartItemById(guestCartItemId: string) {
    return this.prisma.guestCartItem.findUnique({
      where: { id: guestCartItemId },
      include: {
        guestCart: true,
      },
    });
  }

  async updateGuestCartItemQuantity(
    guestCartItemId: string,
    quantity: number,
  ) {
    return this.prisma.guestCartItem.update({
      where: { id: guestCartItemId },
      data: { quantity },
    });
  }

  async deleteGuestCartItem(guestCartItemId: string) {
    return this.prisma.guestCartItem.delete({
      where: { id: guestCartItemId },
    });
  }

  async replaceUserCartAndDeleteGuestCart(
    cartId: string,
    guestCartId: string,
    items: { variantId: string; quantity: number }[],
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: { cartId },
      });

      if (items.length) {
        await tx.cartItem.createMany({
          data: items.map((item) => ({
            cartId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        });
      }

      await tx.guestCart.delete({
        where: { id: guestCartId },
      });
    });

    return this.findCartById(cartId);
  }
}
