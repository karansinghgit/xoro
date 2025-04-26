import { OrderBook } from './orderBook';
import { IncomingOperation, OrderBookOrder, Trade } from '@xoro/common';

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

        // 1. Validate and parse amount and price
        const incomingQuantity = parseFloat(operation.amount);
        const incomingPrice = parseFloat(operation.limit_price);

        if (isNaN(incomingQuantity) || isNaN(incomingPrice) || incomingQuantity <= 0 || incomingPrice <= 0) {
            console.warn(`Invalid amount or price for CREATE operation ${operation.order_id}. Amount: ${operation.amount}, Price: ${operation.limit_price}. Skipping.`);
            return trades;
        }

        // 2. Create the typed order object
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
        if (incomingOrder.quantity > 0) {
            this.orderBook.addOrder(incomingOrder);
        }

        // 5. Return the generated trades
        return trades;
    }
} 