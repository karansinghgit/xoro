import { MatchingEngine } from './matchingEngine';
import { IncomingOperation, OrderBookOrder, Trade } from '@xoro/common';
import { Decimal } from 'decimal.js';

// Define specific input types for clarity and type safety in helpers
interface CreateOperationInput {
    type_op: 'CREATE';
    order_id: string;
    pair: string;
    account_id: string;
    side: 'BUY' | 'SELL';
    amount: string;
    limit_price: string;
}

interface DeleteOperationInput {
    type_op: 'DELETE';
    order_id: string;
    pair: string;
}

// Helper for CREATE part
const createOp = (
    order_id: string,
    side: 'BUY' | 'SELL',
    amount: string,
    limit_price: string,
    pair: string = 'BTC/USD',
    account_id: string = 'testAcc'
): CreateOperationInput => ({
    type_op: 'CREATE',
    order_id,
    pair,
    account_id,
    side,
    amount,
    limit_price,
});

// Helper for DELETE part - Create minimal object matching runtime usage
const deleteOp = (order_id: string, pair: string = 'BTC/USD'): DeleteOperationInput => ({
    type_op: 'DELETE',
    order_id,
    pair,
});

// Helper to create expected Trade objects (with Decimal)
const expectTrade = (
    price: string,
    quantity: string,
    buyOrderId: string,
    sellOrderId: string
): Partial<Trade> => ({ // Use Partial<Trade> and expect specific fields
    price: new Decimal(price),
    quantity: new Decimal(quantity),
    buyOrderId,
    sellOrderId,
    tradeId: expect.any(String),
});

// Helper to create expected OrderBookOrder objects - takes specific CreateOperationInput
const expectBookOrder = (order: CreateOperationInput): OrderBookOrder => ({
    order_id: order.order_id,
    account_id: order.account_id,
    pair: order.pair,
    type: order.side,
    price: new Decimal(order.limit_price),
    quantity: new Decimal(order.amount),
});

// Helper to convert OrderBookOrder Decimals to strings for final book comparison
const stringifyBookOrder = (order: OrderBookOrder) => ({
    ...order,
    price: order.price.toFixed(8),
    quantity: order.quantity.toFixed(8),
});


describe('MatchingEngine', () => {
    let engine: MatchingEngine;
    const buyerAccount = 'buyerAcc';
    const sellerAccount = 'sellerAcc';

    beforeEach(() => {
        engine = new MatchingEngine();
    });

    test('should match a single CREATE buy with a single CREATE sell completely', () => {
        const buyOp = createOp('buy1', 'BUY', '10', '100', 'BTC/USD', buyerAccount);
        const sellOp = createOp('sell1', 'SELL', '10', '100', 'BTC/USD', sellerAccount);

        const trades1 = engine.processOperation(buyOp as IncomingOperation);
        expect(trades1).toHaveLength(0);

        const trades2 = engine.processOperation(sellOp as IncomingOperation);
        expect(trades2).toHaveLength(1);
        expect(trades2[0]).toMatchObject(expectTrade('100', '10', 'buy1', 'sell1'));

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.bids).toHaveLength(0);
        expect(finalBook.asks).toHaveLength(0);
    });

    test('should handle partial fills and leave remaining orders', () => {
        const buyOp = createOp('buy1', 'BUY', '15', '99', 'BTC/USD', buyerAccount);
        const sellOp = createOp('sell1', 'SELL', '10', '99', 'BTC/USD', sellerAccount);

        engine.processOperation(buyOp as IncomingOperation);
        const trades = engine.processOperation(sellOp as IncomingOperation);

        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject(expectTrade('99', '10', 'buy1', 'sell1'));

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.asks).toHaveLength(0);
        expect(finalBook.bids).toHaveLength(1);
        const expectedRemainingOp: CreateOperationInput = { ...buyOp, amount: '5' };
        expect(finalBook.bids).toEqual([stringifyBookOrder(expectBookOrder(expectedRemainingOp))]);
    });

    test('should handle partial fills where incoming order is larger and placed on book', () => {
        engine = new MatchingEngine();
        const sellOp = createOp('sell2', 'SELL', '5', '102', 'BTC/USD', sellerAccount);
        const buyOp = createOp('buy2', 'BUY', '10', '102', 'BTC/USD', buyerAccount);

        engine.processOperation(sellOp as IncomingOperation);
        const trades = engine.processOperation(buyOp as IncomingOperation);
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject(expectTrade('102', '5', 'buy2', 'sell2'));

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.asks).toHaveLength(0);
        expect(finalBook.bids).toHaveLength(1);
        const expectedRemainingOp: CreateOperationInput = { ...buyOp, amount: '5' };
        expect(finalBook.bids).toEqual([stringifyBookOrder(expectBookOrder(expectedRemainingOp))]);
    });

    test('should respect time priority for orders at the same price level', () => {
        const sellOp1 = createOp('sell1', 'SELL', '5', '105', 'BTC/USD', sellerAccount + '1'); // Different sellers
        const sellOp2 = createOp('sell2', 'SELL', '5', '105', 'BTC/USD', sellerAccount + '2');
        const buyOp = createOp('buy1', 'BUY', '7', '105', 'BTC/USD', buyerAccount);

        engine.processOperation(sellOp1 as IncomingOperation);
        engine.processOperation(sellOp2 as IncomingOperation);
        const trades = engine.processOperation(buyOp as IncomingOperation);

        expect(trades).toHaveLength(2);
        expect(trades[0]).toMatchObject(expectTrade('105', '5', 'buy1', 'sell1'));
        expect(trades[1]).toMatchObject(expectTrade('105', '2', 'buy1', 'sell2'));

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.bids).toHaveLength(0);
        expect(finalBook.asks).toHaveLength(1);
        const expectedRemainingOp: CreateOperationInput = { ...sellOp2, amount: '3' };
        expect(finalBook.asks).toEqual([stringifyBookOrder(expectBookOrder(expectedRemainingOp))]);
    });

    test('should add an order to the book if no match is found', () => {
        // No match expected, account IDs don't matter as much
        const buyOp = createOp('buy1', 'BUY', '10', '90', 'BTC/USD', buyerAccount);
        const sellOp = createOp('sell1', 'SELL', '5', '110', 'BTC/USD', sellerAccount);

        const trades1 = engine.processOperation(buyOp as IncomingOperation);
        expect(trades1).toHaveLength(0);

        const trades2 = engine.processOperation(sellOp as IncomingOperation);
        expect(trades2).toHaveLength(0);

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.bids).toHaveLength(1);
        expect(finalBook.asks).toHaveLength(1);
        expect(finalBook.bids).toEqual([stringifyBookOrder(expectBookOrder(buyOp))]);
        expect(finalBook.asks).toEqual([stringifyBookOrder(expectBookOrder(sellOp))]);
    });

    test('should handle DELETE for an existing order', () => {
        // Only one order, account ID doesn't matter for the delete itself
        const buyOp = createOp('buy1', 'BUY', '5', '95', 'BTC/USD', buyerAccount);
        engine.processOperation(buyOp as IncomingOperation);

        let currentBook = engine.getOutputOrderBook();
        expect(currentBook.bids).toHaveLength(1);

        const delOp = deleteOp('buy1');
        const trades = engine.processOperation(delOp as IncomingOperation);
        expect(trades).toHaveLength(0);

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.bids).toHaveLength(0);
        expect(finalBook.asks).toHaveLength(0);
    });

    test('should handle DELETE for a non-existent order gracefully', () => {
        const buyOp = createOp('buy1', 'BUY', '5', '95', 'BTC/USD', buyerAccount);
        engine.processOperation(buyOp as IncomingOperation);

        const delOpNonExistent = deleteOp('buy2');

        // Add a check to see if the warning is called
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const trades = engine.processOperation(delOpNonExistent as IncomingOperation);
        expect(trades).toHaveLength(0);

        expect(consoleWarnSpy).toHaveBeenCalledWith('Order buy2 not found for DELETE operation.');
        consoleWarnSpy.mockRestore();

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.bids).toHaveLength(1);
        expect(finalBook.bids[0].order_id).toBe('buy1');
        expect(finalBook.asks).toHaveLength(0);
    });

    test('should handle DELETE for an already filled order gracefully', () => {
        const buyOp = createOp('buy1', 'BUY', '10', '100', 'BTC/USD', buyerAccount);
        const sellOp = createOp('sell1', 'SELL', '10', '100', 'BTC/USD', sellerAccount);

        engine.processOperation(buyOp as IncomingOperation);
        engine.processOperation(sellOp as IncomingOperation);

        let currentBook = engine.getOutputOrderBook();
        expect(currentBook.bids).toHaveLength(0);
        expect(currentBook.asks).toHaveLength(0);

        const delOpFilled = deleteOp('buy1');

        // Add a check to see if the warning is called
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const trades = engine.processOperation(delOpFilled as IncomingOperation);
        expect(trades).toHaveLength(0);

        expect(consoleWarnSpy).toHaveBeenCalledWith('Order buy1 not found for DELETE operation.');
        consoleWarnSpy.mockRestore();

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.bids).toHaveLength(0);
        expect(finalBook.asks).toHaveLength(0);
    });

    test('should handle sequence: CREATE, CREATE, DELETE first, CREATE matching second', () => {
        const sellOp1 = createOp('sell1', 'SELL', '5', '102', 'BTC/USD', sellerAccount + '1');
        const sellOp2 = createOp('sell2', 'SELL', '8', '103', 'BTC/USD', sellerAccount + '2'); // Different seller

        engine.processOperation(sellOp1 as IncomingOperation);
        engine.processOperation(sellOp2 as IncomingOperation);

        let book1 = engine.getOutputOrderBook();
        expect(book1.asks).toHaveLength(2);

        const delOp1 = deleteOp('sell1');
        const trades1 = engine.processOperation(delOp1 as IncomingOperation);
        expect(trades1).toHaveLength(0);

        let book2 = engine.getOutputOrderBook();
        expect(book2.asks).toHaveLength(1);
        expect(book2.asks[0].order_id).toBe('sell2');

        // Buyer is different from remaining seller
        const buyOp = createOp('buy1', 'BUY', '10', '103', 'BTC/USD', buyerAccount);
        const trades2 = engine.processOperation(buyOp as IncomingOperation);

        expect(trades2).toHaveLength(1);
        expect(trades2[0]).toMatchObject(expectTrade('103', '8', 'buy1', 'sell2'));

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.asks).toHaveLength(0);
        expect(finalBook.bids).toHaveLength(1);
        const expectedRemainingOp: CreateOperationInput = { ...buyOp, amount: '2' };
        expect(finalBook.bids).toEqual([stringifyBookOrder(expectBookOrder(expectedRemainingOp))]);
    });

    test('should handle self-trade prevention (incoming BUY matches own resting SELL)', () => {
        const selfTradeAccount = 'selfTrader';
        const otherAccount = 'otherTrader';
        const restingSellOther = createOp('sellOther', 'SELL', '5', '98', 'BTC/USD', otherAccount);
        const restingSellSelf = createOp('sellSelf', 'SELL', '10', '99', 'BTC/USD', selfTradeAccount);

        engine.processOperation(restingSellOther as IncomingOperation);
        engine.processOperation(restingSellSelf as IncomingOperation);

        const incomingBuySelf = createOp('buySelf', 'BUY', '12', '99', 'BTC/USD', selfTradeAccount);
        const trades = engine.processOperation(incomingBuySelf as IncomingOperation);

        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject(expectTrade('98', '5', 'buySelf', 'sellOther'));

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.asks).toHaveLength(1);
        expect(finalBook.asks[0].order_id).toBe('sellSelf');
        expect(finalBook.bids).toHaveLength(1);
        const expectedRemainingOp: CreateOperationInput = { ...incomingBuySelf, amount: '7' };
        expect(finalBook.bids).toEqual([stringifyBookOrder(expectBookOrder(expectedRemainingOp))]);
    });

    test('should handle self-trade prevention (incoming SELL matches own resting BUY)', () => {
        const selfTradeAccount = 'selfTrader';
        const otherAccount = 'otherTrader';
        const restingBuyOther = createOp('buyOther', 'BUY', '5', '102', 'BTC/USD', otherAccount);
        const restingBuySelf = createOp('buySelf', 'BUY', '10', '101', 'BTC/USD', selfTradeAccount);

        engine.processOperation(restingBuyOther as IncomingOperation);
        engine.processOperation(restingBuySelf as IncomingOperation);

        const incomingSellSelf = createOp('sellSelf', 'SELL', '12', '101', 'BTC/USD', selfTradeAccount);
        const trades = engine.processOperation(incomingSellSelf as IncomingOperation);

        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject(expectTrade('102', '5', 'buyOther', 'sellSelf'));

        const finalBook = engine.getOutputOrderBook();
        expect(finalBook.bids).toHaveLength(1);
        expect(finalBook.bids[0].order_id).toBe('buySelf');
        expect(finalBook.asks).toHaveLength(1);
        const expectedRemainingOp: CreateOperationInput = { ...incomingSellSelf, amount: '7' };
        expect(finalBook.asks).toEqual([stringifyBookOrder(expectBookOrder(expectedRemainingOp))]);
    });

    test('should use loadFromOutput and match correctly against loaded state', () => {
        const engine = new MatchingEngine();
        const initialOrderBook = {
            bids: [
                {
                    order_id: 'existing_bid1',
                    account_id: 'acc1',
                    pair: 'BTC/USD',
                    type: 'BUY' as const,
                    price: '98.50',
                    quantity: '5.00'
                },
                {
                    order_id: 'existing_bid2',
                    account_id: 'acc2',
                    pair: 'BTC/USD',
                    type: 'BUY' as const,
                    price: '97.00',
                    quantity: '3.00'
                }
            ],
            asks: [
                {
                    order_id: 'existing_ask1',
                    account_id: 'acc3',
                    pair: 'BTC/USD',
                    type: 'SELL' as const,
                    price: '101.00',
                    quantity: '4.00'
                }
            ]
        };
        
        engine.loadFromOutput(initialOrderBook);
        
        const currentBook = engine.getOutputOrderBook();
        expect(currentBook.bids.length).toBe(2);
        expect(currentBook.asks.length).toBe(1);
        
        const incomingBuy = createOp('new_buy', 'BUY', '2.00', '101.50', 'BTC/USD', 'buyerAcc');
        const trades = engine.processOperation(incomingBuy as IncomingOperation);
        
        expect(trades.length).toBe(1);
        expect(trades[0].price.toNumber()).toBe(101);
        expect(trades[0].quantity.toNumber()).toBe(2);
        expect(trades[0].buyOrderId).toBe('new_buy');
        expect(trades[0].sellOrderId).toBe('existing_ask1');
        
        const updatedBook = engine.getOutputOrderBook();
        const remainingAsk = updatedBook.asks.find(ask => ask.order_id === 'existing_ask1');
        expect(remainingAsk).toBeDefined();
        expect(remainingAsk?.quantity).toBe('2.00000000');
    });
}); 