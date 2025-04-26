import { OrderBookOrder, OrderBookOutput, Trade } from '@xoro/common';
import { randomUUID } from 'crypto';

export class OrderBook {
  private priceLevels: Map<number, OrderBookOrder[]>;
  private orderById: Map<string, OrderBookOrder>;

  constructor() {
    this.priceLevels = new Map<number, OrderBookOrder[]>();
    this.orderById = new Map<string, OrderBookOrder>();
  }

  // Add an order to the order book
  addOrder(order: OrderBookOrder): void {
    this.orderById.set(order.order_id, order);

    const priceLevel = this.priceLevels.get(order.price);
    if (!priceLevel) {
      this.priceLevels.set(order.price, [order]);
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

    const priceLevel = this.priceLevels.get(order.price);
    if (priceLevel) {
      const index = priceLevel.findIndex(o => o.order_id === orderId);
      if (index !== -1) {
        priceLevel.splice(index, 1);
      }

      if (priceLevel.length === 0) {
        this.priceLevels.delete(order.price);
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
    const priceLevelKeys = Array.from(this.priceLevels.keys());

    if (incomingOrder.type === 'BUY') {
      // Sort the price levels in ascending order
      priceLevelKeys.sort((a, b) => a - b);

      for (const price of priceLevelKeys) {
        if (incomingOrder.quantity <= 0) break;
        if (price > incomingOrder.price) break;

        const ordersAtPrice = this.priceLevels.get(price) || [];
        for (let i = 0; i < ordersAtPrice.length; i++) {
            if (incomingOrder.quantity <= 0) break;

            const restingOrder = ordersAtPrice[i];
            const currentRestingOrder = this.orderById.get(restingOrder.order_id);
            if (!currentRestingOrder || currentRestingOrder.type !== 'SELL' || currentRestingOrder.quantity <= 0) {
                continue;
            }

            // If there is a trade, create a trade object and add it to the trades array
            const tradeQuantity = Math.min(incomingOrder.quantity, currentRestingOrder.quantity);
            if (tradeQuantity > 0) {
                const trade: Trade = {
                    tradeId: randomUUID(),
                    buyOrderId: incomingOrder.order_id,
                    sellOrderId: currentRestingOrder.order_id,
                    price: currentRestingOrder.price,
                    quantity: tradeQuantity,
                    timestamp: Date.now(),
                };
                trades.push(trade);

                incomingOrder.quantity -= tradeQuantity;
                currentRestingOrder.quantity -= tradeQuantity;

                if (currentRestingOrder.quantity <= 0) {
                    this.removeOrderById(currentRestingOrder.order_id);
                    i--; 
                }
            }
        }
      }
    } else { // incomingOrder.type === 'SELL'
      // Sort the price levels in descending order
      priceLevelKeys.sort((a, b) => b - a);

      for (const price of priceLevelKeys) {
        if (incomingOrder.quantity <= 0) break;
        if (price < incomingOrder.price) break;

        const ordersAtPrice = this.priceLevels.get(price) || [];
        for (let i = 0; i < ordersAtPrice.length; i++) {
            if (incomingOrder.quantity <= 0) break;

            const restingOrder = ordersAtPrice[i];
            const currentRestingOrder = this.orderById.get(restingOrder.order_id);
             if (!currentRestingOrder || currentRestingOrder.type !== 'BUY' || currentRestingOrder.quantity <= 0) {
                continue;
            }

            // If there is a trade, create a trade object and add it to the trades array
            const tradeQuantity = Math.min(incomingOrder.quantity, currentRestingOrder.quantity);
            if (tradeQuantity > 0) {
                const trade: Trade = {
                    tradeId: randomUUID(),
                    buyOrderId: currentRestingOrder.order_id,
                    sellOrderId: incomingOrder.order_id,
                    price: currentRestingOrder.price,
                    quantity: tradeQuantity,
                    timestamp: Date.now(),
                };
                trades.push(trade);

                incomingOrder.quantity -= tradeQuantity;
                currentRestingOrder.quantity -= tradeQuantity;

                if (currentRestingOrder.quantity <= 0) {
                    this.removeOrderById(currentRestingOrder.order_id);
                    i--; 
                }
            }
        }
      }
    }

    return trades;
  }

  // Get the current state of the order book as an output object
  getOutputOrderBook(): OrderBookOutput {
    const bids: OrderBookOrder[] = [];
    const asks: OrderBookOrder[] = [];

    for (const ordersAtPrice of this.priceLevels.values()) {
      for (const orderInLevel of ordersAtPrice) {
        const currentOrder = this.orderById.get(orderInLevel.order_id);

        if (currentOrder && currentOrder.quantity > 0) {
          if (currentOrder.type === 'BUY') {
            bids.push(currentOrder);
          } else {
            asks.push(currentOrder);
          }
        }
      }
    }

    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    return { bids, asks };
  }
}
