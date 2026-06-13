import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OrderRepository } from './order.repository';
import { PlaceOrderDto, UpdateOrderStatusDto } from './order.dto';
import calculatePagination from 'src/utils/calculatePagination';
import { CouponType, OrderStatus } from 'src/generated/prisma';

@Injectable()
export class OrderService {
  constructor(private readonly orderRepository: OrderRepository) {}

  // ------------------------------- Place Order -------------------------------
  public async placeOrder(userId: string, placeOrderDto: PlaceOrderDto) {
    // Get customer from userId
    const customer = await this.orderRepository.getCustomerByUserId(userId);
    const customerId = customer.id;
    const {
      addressId,
      street,
      postalCode,
      thanaId,
      isDefault,
      notes,
      couponCode,
      shippingMethodId,
    } = placeOrderDto;

    // Validate: Either addressId OR (street + thanaId) must be provided
    if (!addressId && (!street || !thanaId)) {
      throw new HttpException(
        'Either addressId or address details (street, thanaId) must be provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (addressId && (street || thanaId)) {
      throw new HttpException(
        'Provide either addressId OR address details, not both',
        HttpStatus.BAD_REQUEST,
      );
    }

    let finalAddressId = addressId;

    // If creating new address
    if (!addressId && street && thanaId) {
      // Validate thana exists
      const thanaExists = await this.orderRepository.findThanaById(thanaId);
      if (!thanaExists) {
        throw new HttpException('Thana not found', HttpStatus.NOT_FOUND);
      }

      // Create or update address, handling isDefault flag
      const newAddress = await this.orderRepository.createOrUpdateAddressByUserAndThana({
        userId,
        thanaId,
        street,
        postalCode,
        isDefault,
      });
      finalAddressId = newAddress.id;
    } else if (addressId) {
      // Validate existing address
      const address = await this.orderRepository.findAddressById(addressId);
      if (!address) {
        throw new HttpException('Address not found', HttpStatus.NOT_FOUND);
      }
    }

    // Get cart with items
    const cart = await this.orderRepository.findCartWithItems(customerId);

    if (!cart || cart.items.length === 0) {
      throw new HttpException(
        'Cart is empty. Add items before placing order',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate stock availability for all items
    for (const item of cart.items) {
      if (item.variant.stockQuantity < item.quantity) {
        throw new HttpException(
          `Insufficient stock for ${item.variant.product.name}. Only ${item.variant.stockQuantity} items available`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Calculate subtotal
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + Number(item.variant.price) * item.quantity;
    }, 0);

    // Resolve shipping cost from shippingMethodId
    let shippingCost = 0;
    if (shippingMethodId) {
      const shippingMethod = await this.orderRepository.findShippingMethodById(shippingMethodId);
      if (!shippingMethod) {
        throw new HttpException('Shipping method not found', HttpStatus.NOT_FOUND);
      }
      if (!shippingMethod.isActive) {
        throw new HttpException('Shipping method is not active', HttpStatus.BAD_REQUEST);
      }
      shippingCost = Number(shippingMethod.cost ?? 0);
    }

    // Validate coupon and compute discount
    let couponId: string | undefined;
    let discount = 0;
    if (couponCode) {
      const coupon = await this.orderRepository.findCouponByCode(couponCode);
      if (!coupon) {
        throw new HttpException('Invalid coupon code', HttpStatus.BAD_REQUEST);
      }

      const now = new Date();
      if (coupon.startsAt && coupon.startsAt > now) {
        throw new HttpException('Coupon is not started yet', HttpStatus.BAD_REQUEST);
      }
      if (coupon.expiresAt && coupon.expiresAt < now) {
        throw new HttpException('Coupon has expired', HttpStatus.BAD_REQUEST);
      }
      if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
        throw new HttpException('Coupon usage limit has been reached', HttpStatus.BAD_REQUEST);
      }

      if (coupon.minOrderAmount !== null && subtotal < Number(coupon.minOrderAmount)) {
        throw new HttpException(
          `Minimum order amount of ${Number(coupon.minOrderAmount).toFixed(2)} is required for this coupon`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (coupon.userUsageLimit !== null) {
        const usedCount = await this.orderRepository.countCouponUsageByCustomer(customerId, coupon.id);
        if (usedCount >= coupon.userUsageLimit) {
          throw new HttpException('Coupon usage limit reached for this user', HttpStatus.BAD_REQUEST);
        }
      }

      // Determine eligible items based on applicableProductIds
      const restrictByProducts = coupon.applicableProductIds.length > 0;
      const eligibleItems = restrictByProducts
        ? cart.items.filter((item) => coupon.applicableProductIds.includes(item.variant.productId))
        : cart.items;

      const eligibleAmount = eligibleItems.reduce((sum, item) => {
        return sum + Number(item.variant.price) * item.quantity;
      }, 0);

      if (restrictByProducts && eligibleAmount === 0) {
        throw new HttpException('Coupon is not applicable to selected products', HttpStatus.BAD_REQUEST);
      }

      let discountAmount = 0;
      if (coupon.type === CouponType.PERCENTAGE) {
        discountAmount = (eligibleAmount * Number(coupon.value)) / 100;
      } else if (coupon.type === CouponType.FIXED_AMOUNT) {
        discountAmount = Math.min(Number(coupon.value), eligibleAmount);
      }

      if (coupon.maxDiscountAmount !== null) {
        discountAmount = Math.min(discountAmount, Number(coupon.maxDiscountAmount));
      }

      discount = Math.max(0, Math.min(discountAmount, subtotal));
      couponId = coupon.id;
    }

    const total = subtotal - discount + shippingCost;

    // Generate order number
    const orderNumber = await this.orderRepository.generateOrderNumber();

    // Ensure finalAddressId is defined (should always be true due to validation)
    if (!finalAddressId) {
      throw new HttpException(
        'Address validation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Create order with transaction (will rollback on any error)
    try {
      const order = await this.orderRepository.createOrderWithTransaction(
        customerId,
        finalAddressId,
        orderNumber,
        cart.items,
        subtotal,
        shippingCost,
        discount,
        total,
        notes,
        couponId,
        shippingMethodId,
      );

      return order;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to place order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ------------------------------- Get My Orders -------------------------------
  public async getMyOrders(
    userId: string,
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: string,
    searchTerm?: string,
  ) {
    const { skip, take } = calculatePagination({
      page: pageNumber,
      take: pageSize,
    });

    // Get customer from userId
    const customer = await this.orderRepository.getCustomerByUserId(userId);
    const customerId = customer.id;

    const [orders, total] = await Promise.all([
      this.orderRepository.findMyOrders(
        customerId,
        skip,
        take,
        sortBy,
        sortOrder,
        status,
        searchTerm,
      ),
      this.orderRepository.countMyOrders(customerId, status, searchTerm),
    ]);

    return {
      data: orders,
      meta: {
        pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        totalCount: total,
      },
    };
  }

  // ------------------------------- Get All Orders (Admin) -------------------------------
  public async getAllOrders(
    pageNumber: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: string,
    searchTerm?: string,
    deliveredFrom?: string,
    deliveredTo?: string,
    customerId?: string,
  ) {
    const { skip, take } = calculatePagination({
      page: pageNumber,
      take: pageSize,
    });

    const [orders, total] = await Promise.all([
      this.orderRepository.findAllOrders(
        skip,
        take,
        sortBy,
        sortOrder,
        status,
        searchTerm,
        deliveredFrom,
        deliveredTo,
        customerId,
      ),
      this.orderRepository.countAllOrders(
        status,
        searchTerm,
        deliveredFrom,
        deliveredTo,
        customerId,
      ),
    ]);

    return {
      data: orders,
      meta: {
        pageNumber,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        totalCount: total,
      },
    };
  }

  // ------------------------------- Get Single Order -------------------------------
  public async getSingleOrder(userId: string, orderId: string) {
    // Get customer from userId
    const customer = await this.orderRepository.getCustomerByUserId(userId);
    const customerId = customer.id;
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    // Verify the order belongs to the customer
    if (order.customerId !== customerId) {
      throw new HttpException(
        'Unauthorized to view this order',
        HttpStatus.FORBIDDEN,
      );
    }

    return order;
  }

  // ------------------------------- Get Single Order (Admin) -------------------------------
  public async getSingleOrderAdmin(orderId: string) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    return order;
  }

  // ------------------------------- Update Order Status -------------------------------
  public async updateOrderStatus(
    orderId: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    const { status, internalNotes } = updateOrderStatusDto;

    // Check if order exists
    const existingOrder = await this.orderRepository.findById(orderId);

    if (!existingOrder) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    // Prevent status update if already cancelled, delivered, or refunded
    const finalStatuses: readonly OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.DELIVERED,
      OrderStatus.REFUNDED,
    ];
    if (
      (finalStatuses as readonly OrderStatus[]).includes(existingOrder.status)
    ) {
      throw new HttpException(
        `Cannot update order status from ${existingOrder.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const order = await this.orderRepository.updateOrderStatus(
      orderId,
      status,
      internalNotes,
    );

    return order;
  }

  // ------------------------------- Cancel Order -------------------------------
  public async cancelOrder(userId: string, orderId: string) {
    // Get customer from userId
    const customer = await this.orderRepository.getCustomerByUserId(userId);
    const customerId = customer.id;
    // Check if order exists
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    // Verify the order belongs to the customer
    if (order.customerId !== customerId) {
      throw new HttpException(
        'Unauthorized to cancel this order',
        HttpStatus.FORBIDDEN,
      );
    }

    // Only allow cancellation for PENDING or CONFIRMED orders
    const cancellableStatuses: readonly OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
    ];
    if (
      !(cancellableStatuses as readonly OrderStatus[]).includes(order.status)
    ) {
      throw new HttpException(
        `Cannot cancel order with status ${order.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Cancel order and restore stock
    try {
      const cancelledOrder =
        await this.orderRepository.cancelOrderWithStockAdjustment(orderId);
      return cancelledOrder;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to cancel order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ------------------------------- Cancel Order (Admin) -------------------------------
  public async cancelOrderAdmin(orderId: string, internalNotes?: string) {
    // Check if order exists
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    // Admin can cancel orders in more states
    const nonCancellableStatuses: readonly OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.DELIVERED,
      OrderStatus.REFUNDED,
      OrderStatus.RETURNED,
    ];
    if (
      (nonCancellableStatuses as readonly OrderStatus[]).includes(order.status)
    ) {
      throw new HttpException(
        `Cannot cancel order with status ${order.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Cancel order and restore stock
    try {
      const cancelledOrder =
        await this.orderRepository.cancelOrderWithStockAdjustment(orderId);

      // Update internal notes if provided
      if (internalNotes) {
        await this.orderRepository.updateOrderStatus(
          orderId,
          OrderStatus.CANCELLED,
          internalNotes,
        );
      }

      return cancelledOrder;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to cancel order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
