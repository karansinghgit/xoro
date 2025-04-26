import { OrderBook } from './orderBook';
import { IncomingOperation, OrderBookOrder, Trade, OrderBookOutput } from '@xoro/common';
import { Decimal } from 'decimal.js';

export class MatchingEngine {
    private orderBook: OrderBook;

    constructor() {
        this.orderBook = new OrderBook();
        console.log("MatchingEngine initialized");
    }

    processOperation(operation: IncomingOperation): Trade[] {
        let trades: Trade[] = [];

        if (operation.type_op === 'DELETE') {
            const removed = this.orderBook.removeOrderById(operation.order_id);
            if (!removed) {
                console.warn(`Order ${operation.order_id} not found for DELETE operation.`);
            }
            return trades;
        }

        let incomingQuantity: Decimal;
        let incomingPrice: Decimal;

        try {
            // 1. Parse amount and price into Decimal
            incomingQuantity = new Decimal(operation.amount);
            incomingPrice = new Decimal(operation.limit_price);

            // Basic validation: check if positive
            if (incomingQuantity.isNegative() || incomingQuantity.isZero() || incomingPrice.isNegative() || incomingPrice.isZero()) {
                console.warn(`Invalid amount or price for CREATE operation ${operation.order_id}. Amount: ${operation.amount}, Price: ${operation.limit_price}. Must be positive. Skipping.`);
                return trades;
            }
        } catch (error) {
            console.warn(`Error parsing amount or price for CREATE operation ${operation.order_id}. Amount: ${operation.amount}, Price: ${operation.limit_price}. Skipping.`, error);
            return trades;
        }

        // 2. Create the typed order object with Decimal values
        const incomingOrder: OrderBookOrder = {
            order_id: operation.order_id,
            account_id: operation.account_id,
            pair: operation.pair,
            type: operation.side.toUpperCase() as 'BUY' | 'SELL',
            price: incomingPrice,
            quantity: incomingQuantity,
        };

        // 3. Perform matching by calling the order book
        trades = this.orderBook.matchIncomingOrder(incomingOrder);

        // 4. If the incoming order has remaining quantity, add it to the book
        if (incomingOrder.quantity.greaterThan(0)) {
            this.orderBook.addOrder(incomingOrder);
        }

        // 5. Return the generated trades
        return trades;
    }

    public getOutputOrderBook(): OrderBookOutput {
        return this.orderBook.getOutputOrderBook();
    }
} 