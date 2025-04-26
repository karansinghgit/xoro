import { OrderBookOrder, OrderBookOutput, Trade, OutputOrder } from '@xoro/common';
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';

export class OrderBook {
  // Use string representation of price for Map keys
  private priceLevels: Map<string, OrderBookOrder[]>;
  private orderById: Map<string, OrderBookOrder>;

  constructor() {
    this.priceLevels = new Map<string, OrderBookOrder[]>();
    this.orderById = new Map<string, OrderBookOrder>();
  }

  // Add an order to the order book
  addOrder(order: OrderBookOrder): void {
    // Ensure quantity is positive
    if (order.quantity.lessThanOrEqualTo(0)) return;

    this.orderById.set(order.order_id, order);

    const priceStr = order.price.toString(); // Use string price for key
    const priceLevel = this.priceLevels.get(priceStr);
    if (!priceLevel) {
      this.priceLevels.set(priceStr, [order]);
    } else {
      priceLevel.push(order);
    }
  }

  // Remove an order from the order book by order ID
  removeOrderById(orderId: string): boolean {
    const order = this.orderById.get(orderId);
    if (!order) {
      return false;
    }

    this.orderById.delete(orderId);

    const priceStr = order.price.toString(); // Use string price for key
    const priceLevel = this.priceLevels.get(priceStr);
    if (priceLevel) {
      const index = priceLevel.findIndex(o => o.order_id === orderId);
      if (index !== -1) {
        priceLevel.splice(index, 1);
      }

      if (priceLevel.length === 0) {
        this.priceLevels.delete(priceStr);
      }
    }

    return true;
  }

  // Get an order by order ID
  getOrderById(orderId: string): OrderBookOrder | undefined {
    return this.orderById.get(orderId);
  }

  // Match an incoming order against the order book
  matchIncomingOrder(incomingOrder: OrderBookOrder): Trade[] {
    const trades: Trade[] = [];
    // Get price keys as strings, convert to Decimal for sorting
    const priceLevelKeys = Array.from(this.priceLevels.keys()).map(p => new Decimal(p));

    if (incomingOrder.type === 'BUY') {
      // Sort Decimal prices in ascending order
      priceLevelKeys.sort((a, b) => a.comparedTo(b));

      for (const price of priceLevelKeys) {
        // Use Decimal comparisons
        if (incomingOrder.quantity.lessThanOrEqualTo(0)) break;
        if (price.greaterThan(incomingOrder.price)) break;

        const priceStr = price.toString();
        const ordersAtPrice = this.priceLevels.get(priceStr) || [];
        for (let i = 0; i < ordersAtPrice.length; i++) {
            if (incomingOrder.quantity.lessThanOrEqualTo(0)) break;

            const restingOrderRef = ordersAtPrice[i]; // Reference from priceLevel
            // Get the authoritative order state from orderById map
            const restingOrder = this.orderById.get(restingOrderRef.order_id);
            if (!restingOrder || restingOrder.type !== 'SELL' || restingOrder.quantity.lessThanOrEqualTo(0)) {
                continue;
            }

            // Prevent self-trading
            if (restingOrder.account_id === incomingOrder.account_id) {
                continue; // Skip matching with own order
            }

            // Calculate trade quantity using Decimal.min
            const tradeQuantity = Decimal.min(incomingOrder.quantity, restingOrder.quantity);
            if (tradeQuantity.greaterThan(0)) {
                // Create trade with Decimal values
                const trade: Trade = {
                    tradeId: randomUUID(),
                    buyOrderId: incomingOrder.order_id,
                    sellOrderId: restingOrder.order_id,
                    price: restingOrder.price, // Trade occurs at resting order's price
                    quantity: tradeQuantity,
                    timestamp: Date.now(),
                };
                trades.push(trade);

                // Update quantities using Decimal.sub
                incomingOrder.quantity = incomingOrder.quantity.sub(tradeQuantity);
                restingOrder.quantity = restingOrder.quantity.sub(tradeQuantity);

                // Update the order in the central map
                this.orderById.set(restingOrder.order_id, restingOrder);

                // If resting order is fully filled, remove it
                if (restingOrder.quantity.lessThanOrEqualTo(0)) {
                    this.removeOrderById(restingOrder.order_id);
                    i--; // Adjust index after removal
                }
            }
        }
      }
    } else { // incomingOrder.type === 'SELL'
      // Sort Decimal prices in descending order
      priceLevelKeys.sort((a, b) => b.comparedTo(a));

      for (const price of priceLevelKeys) {
        // Use Decimal comparisons
        if (incomingOrder.quantity.lessThanOrEqualTo(0)) break;
        if (price.lessThan(incomingOrder.price)) break;

        const priceStr = price.toString();
        const ordersAtPrice = this.priceLevels.get(priceStr) || [];
        for (let i = 0; i < ordersAtPrice.length; i++) {
            if (incomingOrder.quantity.lessThanOrEqualTo(0)) break;

            const restingOrderRef = ordersAtPrice[i]; // Reference from priceLevel
            // Get the authoritative order state from orderById map
            const restingOrder = this.orderById.get(restingOrderRef.order_id);
            if (!restingOrder || restingOrder.type !== 'BUY' || restingOrder.quantity.lessThanOrEqualTo(0)) {
                continue;
            }

            // Prevent self-trading
            if (restingOrder.account_id === incomingOrder.account_id) {
                continue; // Skip matching with own order
            }

            // Calculate trade quantity using Decimal.min
            const tradeQuantity = Decimal.min(incomingOrder.quantity, restingOrder.quantity);
            if (tradeQuantity.greaterThan(0)) {
                // Create trade with Decimal values
                const trade: Trade = {
                    tradeId: randomUUID(),
                    buyOrderId: restingOrder.order_id,
                    sellOrderId: incomingOrder.order_id,
                    price: restingOrder.price, // Trade occurs at resting order's price
                    quantity: tradeQuantity,
                    timestamp: Date.now(),
                };
                trades.push(trade);

                // Update quantities using Decimal.sub
                incomingOrder.quantity = incomingOrder.quantity.sub(tradeQuantity);
                restingOrder.quantity = restingOrder.quantity.sub(tradeQuantity);

                // Update the order in the central map
                this.orderById.set(restingOrder.order_id, restingOrder);

                // If resting order is fully filled, remove it
                if (restingOrder.quantity.lessThanOrEqualTo(0)) {
                    this.removeOrderById(restingOrder.order_id);
                    i--; // Adjust index after removal
                }
            }
        }
      }
    }

    // Update incoming order state if partially filled
    if (incomingOrder.quantity.greaterThan(0)) {
        this.orderById.set(incomingOrder.order_id, incomingOrder);
    }

    return trades;
  }

  // Get the current state of the order book for output (with string prices/quantities)
  getOutputOrderBook(): OrderBookOutput {
    const bids: OutputOrder[] = [];
    const asks: OutputOrder[] = [];

    // Iterate through all orders stored by ID
    for (const order of this.orderById.values()) {
        // Consider only orders with positive quantity
        if (order.quantity.greaterThan(0)) {
          // Use a fixed number of decimal places for output consistency
          const priceStr = order.price.toFixed(8); // Example: 8 decimal places
          const quantityStr = order.quantity.toFixed(8); // Example: 8 decimal places

          const outputOrder: OutputOrder = {
              // Explicitly list properties to ensure correct type
              order_id: order.order_id,
              account_id: order.account_id,
              pair: order.pair,
              type: order.type,
              price: priceStr,
              quantity: quantityStr,
          };
          if (outputOrder.type === 'BUY') {
            bids.push(outputOrder);
          } else {
            asks.push(outputOrder);
          }
        }
    }

    // Sort bids descending by price (using Decimal for comparison)
    bids.sort((a, b) => new Decimal(b.price).comparedTo(new Decimal(a.price)));
    // Sort asks ascending by price (using Decimal for comparison)
    asks.sort((a, b) => new Decimal(a.price).comparedTo(new Decimal(b.price)));

    return { bids, asks };
  }
}
