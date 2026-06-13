import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OrderRepository } from './order.repository';
import { PlaceOrderDto, UpdateOrderStatusDto } from './order.dto';
import calculatePagination from 'src/utils/calculatePagination';
import { OrderStatus } from 'src/generated/prisma';

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

    // Calculate totals
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + Number(item.variant.price) * item.quantity;
    }, 0);

    // Simple shipping calculation (you can make this more complex)
    const shippingCost = subtotal > 100 ? 0 : 10; // Free shipping over $100

    const total = subtotal + shippingCost;

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
        total,
        notes,
        couponCode,
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
