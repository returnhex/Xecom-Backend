import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, OrderStatus, InventoryReason } from 'src/generated/prisma';

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerByUserId(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (!customer) {
      throw new Error('Customer not found. Please complete your profile.');
    }

    return customer;
  }

  async findCartWithItems(customerId: string) {
    return this.prisma.cart.findFirst({
      where: { customerId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    brand: true,
                    category: true,
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
      },
    });
  }

  async generateOrderNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  async createOrderWithTransaction(
    customerId: string,
    addressId: string,
    orderNumber: string,
    cartItems: any[],
    subtotal: number,
    shippingCost: number,
    total: number,
    notes?: string,
    couponCode?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          customerId,
          addressId,
          orderNumber,
          subtotal,
          shippingCost,
          total,
          notes,
          couponCode,
          status: OrderStatus.PENDING,
        },
        include: {
          address: {
            include: {
              thana: {
                include: {
                  district: {
                    include: {
                      division: {
                        include: {
                          country: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Create order items and update inventory
      for (const item of cartItems) {
        // Check stock availability
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
        });

        if (!variant || variant.stockQuantity < item.quantity) {
          throw new Error(
            `Insufficient stock for SKU: ${variant?.sku || item.variantId}`,
          );
        }

        // Create order item
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.variant.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.variant.price,
            totalPrice: item.variant.price * item.quantity,
          },
        });

        // Update stock
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });

        // Create inventory log
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            change: -item.quantity,
            reason: InventoryReason.SALE,
            referenceId: order.id,
            note: `Order #${orderNumber}`,
          },
        });
      }

      // Delete cart items
      await tx.cartItem.deleteMany({
        where: {
          cartId: cartItems[0].cartId,
        },
      });

      return order;
    });
  }

  async findMyOrders(
    customerId: string,
    skip: number,
    take: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: string,
    searchTerm?: string,
  ) {
    const where: Prisma.OrderWhereInput = {
      customerId,
    };

    if (status) {
      where.status = status as OrderStatus;
    }

    if (searchTerm) {
      where.OR = [
        { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
        { trackingNumber: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput = sortBy
      ? ({
          [sortBy]: sortOrder || 'desc',
        } as Prisma.OrderOrderByWithRelationInput)
      : { placedAt: 'desc' as Prisma.SortOrder };

    return this.prisma.order.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        orderItems: {
          include: {
            product: {
              include: {
                images: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            variant: true,
          },
        },
        address: {
          include: {
            thana: {
              include: {
                district: {
                  include: {
                    division: {
                      include: {
                        country: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async countMyOrders(
    customerId: string,
    status?: string,
    searchTerm?: string,
  ) {
    const where: Prisma.OrderWhereInput = {
      customerId,
    };

    if (status) {
      where.status = status as OrderStatus;
    }

    if (searchTerm) {
      where.OR = [
        { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
        { trackingNumber: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.order.count({ where });
  }

  async findAllOrders(
    skip: number,
    take: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: string,
    searchTerm?: string,
    deliveredFrom?: string,
    deliveredTo?: string,
    customerId?: string,
  ) {
    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status as OrderStatus;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (deliveredFrom || deliveredTo) {
      where.deliveredAt = {};
      if (deliveredFrom) {
        where.deliveredAt.gte = new Date(deliveredFrom);
      }
      if (deliveredTo) {
        where.deliveredAt.lte = new Date(deliveredTo);
      }
    }

    if (searchTerm) {
      where.OR = [
        { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
        { trackingNumber: { contains: searchTerm, mode: 'insensitive' } },
        {
          customer: {
            user: { name: { contains: searchTerm, mode: 'insensitive' } },
          },
        },
      ];
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput = sortBy
      ? ({
          [sortBy]: sortOrder || 'desc',
        } as Prisma.OrderOrderByWithRelationInput)
      : { placedAt: 'desc' as Prisma.SortOrder };

    return this.prisma.order.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        customer: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        orderItems: {
          include: {
            product: {
              include: {
                images: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            variant: true,
          },
        },
        address: {
          include: {
            thana: {
              include: {
                district: {
                  include: {
                    division: {
                      include: {
                        country: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async countAllOrders(
    status?: string,
    searchTerm?: string,
    deliveredFrom?: string,
    deliveredTo?: string,
    customerId?: string,
  ) {
    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status as OrderStatus;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (deliveredFrom || deliveredTo) {
      where.deliveredAt = {};
      if (deliveredFrom) {
        where.deliveredAt.gte = new Date(deliveredFrom);
      }
      if (deliveredTo) {
        where.deliveredAt.lte = new Date(deliveredTo);
      }
    }

    if (searchTerm) {
      where.OR = [
        { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
        { trackingNumber: { contains: searchTerm, mode: 'insensitive' } },
        {
          customer: {
            user: { name: { contains: searchTerm, mode: 'insensitive' } },
          },
        },
      ];
    }

    return this.prisma.order.count({ where });
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        orderItems: {
          include: {
            product: {
              include: {
                brand: true,
                category: true,
                images: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            variant: {
              include: {
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
        address: {
          include: {
            thana: {
              include: {
                district: {
                  include: {
                    division: {
                      include: {
                        country: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        payments: true,
        shipments: true,
      },
    });
  }

  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    internalNotes?: string,
  ) {
    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        internalNotes,
        ...(status === OrderStatus.DELIVERED && { deliveredAt: new Date() }),
      },
    });
  }

  async cancelOrderWithStockAdjustment(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Get order with items
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: true,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Restore stock for each item
      for (const item of order.orderItems) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
          },
        });

        // Create inventory log
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            change: item.quantity,
            reason: InventoryReason.RETURN,
            referenceId: orderId,
            note: `Order #${order.orderNumber} cancelled`,
          },
        });
      }

      // Update order status
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });
    });
  }

  async findAddressById(addressId: string) {
    return this.prisma.address.findUnique({
      where: { id: addressId },
    });
  }

  async findThanaById(thanaId: string) {
    return this.prisma.thana.findUnique({
      where: { id: thanaId },
    });
  }

  async createOrUpdateAddressByUserAndThana(data: {
    userId: string;
    thanaId: string;
    postalCode?: number;
    street: string;
    isDefault?: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.address.updateMany({
          where: { userId: data.userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const existing = await tx.address.findFirst({
        where: { userId: data.userId, thanaId: data.thanaId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (existing) {
        return tx.address.update({
          where: { id: existing.id },
          data: {
            street: data.street,
            ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
            ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
          },
        });
      }

      return tx.address.create({
        data: {
          userId: data.userId,
          thanaId: data.thanaId,
          postalCode: data.postalCode,
          street: data.street,
          isDefault: data.isDefault ?? false,
        },
      });
    });
  }
}
