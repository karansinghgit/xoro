import { OrderBook } from './orderBook';
import { OrderBookOrder } from '@xoro/common';

describe('OrderBook', () => {
  let orderBook: OrderBook;

  const buyOrder1: OrderBookOrder = {
    order_id: 'buy1', account_id: 'acc1', pair: 'BTC/USD', type: 'BUY', price: 100, quantity: 10
  };
  const buyOrder2: OrderBookOrder = {
    order_id: 'buy2', account_id: 'acc2', pair: 'BTC/USD', type: 'BUY', price: 101, quantity: 5
  };
   const buyOrder3_samePrice: OrderBookOrder = {
    order_id: 'buy3', account_id: 'acc3', pair: 'BTC/USD', type: 'BUY', price: 100, quantity: 8
  };
  const sellOrder1: OrderBookOrder = {
    order_id: 'sell1', account_id: 'acc3', pair: 'BTC/USD', type: 'SELL', price: 102, quantity: 12
  };
  const sellOrder2: OrderBookOrder = {
    order_id: 'sell2', account_id: 'acc4', pair: 'BTC/USD', type: 'SELL', price: 101, quantity: 6
  };
  const sellOrder3_samePrice: OrderBookOrder = {
    order_id: 'sell3', account_id: 'acc5', pair: 'BTC/USD', type: 'SELL', price: 102, quantity: 7
  };

  beforeEach(() => {
    orderBook = new OrderBook();
  });

  test('should add orders correctly', () => {
    orderBook.addOrder(buyOrder1);
    orderBook.addOrder(sellOrder1);
    expect(orderBook.getOrderById('buy1')).toEqual(buyOrder1);
    expect(orderBook.getOrderById('sell1')).toEqual(sellOrder1);
  });

  test('should remove existing orders and return true', () => {
    orderBook.addOrder(buyOrder1);
    const result = orderBook.removeOrderById('buy1');
    expect(result).toBe(true);
    expect(orderBook.getOrderById('buy1')).toBeUndefined();
  });

  test('should return false when removing non-existent orders', () => {
    const result = orderBook.removeOrderById('nonexistent');
    expect(result).toBe(false);
  });

  test('should retrieve existing order by ID', () => {
    orderBook.addOrder(buyOrder1);
    expect(orderBook.getOrderById('buy1')).toEqual(buyOrder1);
  });

  test('should return undefined for non-existent order ID', () => {
    expect(orderBook.getOrderById('nonexistent')).toBeUndefined();
  });

  test('getOutputOrderBook should return sorted bids and asks', () => {
    orderBook.addOrder(buyOrder1); // 100
    orderBook.addOrder(buyOrder2); // 101
    orderBook.addOrder(buyOrder3_samePrice); // 100
    orderBook.addOrder(sellOrder1); // 102
    orderBook.addOrder(sellOrder2); // 101
    orderBook.addOrder(sellOrder3_samePrice); // 102

    const output = orderBook.getOutputOrderBook();

    expect(output.bids).toEqual([buyOrder2, buyOrder1, buyOrder3_samePrice]);
    expect(output.asks).toEqual([sellOrder2, sellOrder1, sellOrder3_samePrice]);
  });

   test('getOutputOrderBook should reflect removed orders', () => {
    orderBook.addOrder(buyOrder1);
    orderBook.addOrder(sellOrder1);
    orderBook.removeOrderById('buy1');

    const output = orderBook.getOutputOrderBook();
    expect(output.bids).toEqual([]);
    expect(output.asks).toEqual([sellOrder1]);
  });

  test('getOutputOrderBook should handle empty price levels after removal', () => {
    orderBook.addOrder(buyOrder1);
    orderBook.removeOrderById('buy1');
    orderBook.addOrder(sellOrder1);

    const output = orderBook.getOutputOrderBook();
    expect(output.bids).toEqual([]);
    expect(output.asks).toEqual([sellOrder1]);
    orderBook.addOrder(buyOrder2);
    const output2 = orderBook.getOutputOrderBook();
    expect(output2.bids).toEqual([buyOrder2]);
    expect(output2.asks).toEqual([sellOrder1]);
  });

  test('getOutputOrderBook should exclude orders with quantity 0', () => {
    const zeroQuantityOrder: OrderBookOrder = {
      ...buyOrder1, quantity: 0
    };
    orderBook.addOrder(zeroQuantityOrder);
    orderBook.addOrder(sellOrder1);

    const output = orderBook.getOutputOrderBook();
    expect(output.bids).toEqual([]);
    expect(output.asks).toEqual([sellOrder1]);
  });

});

// --- Tests for matchIncomingOrder ---
describe('OrderBook - matchIncomingOrder', () => {
  let orderBook: OrderBook;

  const restingSell: OrderBookOrder = { order_id: 'sell1', account_id: 'accS1', pair: 'BTC/USD', type: 'SELL', price: 100, quantity: 10 };
  const restingBuy: OrderBookOrder = { order_id: 'buy1', account_id: 'accB1', pair: 'BTC/USD', type: 'BUY', price: 95, quantity: 10 };
  const restingSellLower: OrderBookOrder = { order_id: 'sell2', account_id: 'accS2', pair: 'BTC/USD', type: 'SELL', price: 98, quantity: 5 };
  const restingBuyHigher: OrderBookOrder = { order_id: 'buy2', account_id: 'accB2', pair: 'BTC/USD', type: 'BUY', price: 97, quantity: 5 };

  beforeEach(() => {
    orderBook = new OrderBook();
    orderBook.addOrder({...restingSell});
    orderBook.addOrder({...restingBuy});
    orderBook.addOrder({...restingSellLower});
    orderBook.addOrder({...restingBuyHigher});
  });

  test('incoming buy should fully fill the best ask', () => {
    const incomingBuy: OrderBookOrder = { order_id: 'newBuy1', account_id: 'accNB1', pair: 'BTC/USD', type: 'BUY', price: 98, quantity: 5 };
    const trades = orderBook.matchIncomingOrder(incomingBuy);

    expect(trades).toHaveLength(1);
    expect(trades[0].price).toBe(98);
    expect(trades[0].quantity).toBe(5);
    expect(trades[0].buyOrderId).toBe('newBuy1');
    expect(trades[0].sellOrderId).toBe('sell2');

    expect(incomingBuy.quantity).toBe(0);
    expect(orderBook.getOrderById('sell2')).toBeUndefined();
    expect(orderBook.getOrderById('sell1')?.quantity).toBe(10);
  });

  test('incoming sell should partially fill the best bid', () => {
    const incomingSell: OrderBookOrder = { order_id: 'newSell1', account_id: 'accNS1', pair: 'BTC/USD', type: 'SELL', price: 97, quantity: 3 };
    const trades = orderBook.matchIncomingOrder(incomingSell);

    expect(trades).toHaveLength(1);
    expect(trades[0].price).toBe(97);
    expect(trades[0].quantity).toBe(3);
    expect(trades[0].buyOrderId).toBe('buy2');
    expect(trades[0].sellOrderId).toBe('newSell1');

    expect(incomingSell.quantity).toBe(0); // Incoming fully filled
    expect(orderBook.getOrderById('buy2')?.quantity).toBe(2); // Resting partially filled
    expect(orderBook.getOrderById('buy1')?.quantity).toBe(10); // Other buy untouched
  });

  test('incoming buy should fill multiple asks', () => {
    const incomingBuy: OrderBookOrder = { order_id: 'newBuy2', account_id: 'accNB2', pair: 'BTC/USD', type: 'BUY', price: 100, quantity: 12 }; // Price matches sell1 & sell2
    const trades = orderBook.matchIncomingOrder(incomingBuy);

    expect(trades).toHaveLength(2);
    // Match 1: vs sell2 (price 98)
    expect(trades[0].price).toBe(98);
    expect(trades[0].quantity).toBe(5);
    expect(trades[0].sellOrderId).toBe('sell2');
    // Match 2: vs sell1 (price 100)
    expect(trades[1].price).toBe(100);
    expect(trades[1].quantity).toBe(7); // Remaining 12-5=7
    expect(trades[1].sellOrderId).toBe('sell1');

    expect(incomingBuy.quantity).toBe(0); // Incoming fully filled
    expect(orderBook.getOrderById('sell2')).toBeUndefined(); // First resting removed
    expect(orderBook.getOrderById('sell1')?.quantity).toBe(3); // Second resting partially filled
  });

  test('incoming order should not match if price is not met', () => {
    const incomingBuy: OrderBookOrder = { order_id: 'newBuy3', account_id: 'accNB3', pair: 'BTC/USD', type: 'BUY', price: 90, quantity: 5 }; // Price too low
    const trades = orderBook.matchIncomingOrder(incomingBuy);

    expect(trades).toHaveLength(0);
    expect(incomingBuy.quantity).toBe(5); // Quantity unchanged
    // Check resting orders are untouched
    expect(orderBook.getOrderById('sell1')?.quantity).toBe(10);
    expect(orderBook.getOrderById('sell2')?.quantity).toBe(5);
  });

  test('incoming order should not match if no opposite side orders exist', () => {
    // Remove all sells first
    orderBook.removeOrderById('sell1');
    orderBook.removeOrderById('sell2');

    const incomingBuy: OrderBookOrder = { order_id: 'newBuy4', account_id: 'accNB4', pair: 'BTC/USD', type: 'BUY', price: 100, quantity: 5 };
    const trades = orderBook.matchIncomingOrder(incomingBuy);

    expect(trades).toHaveLength(0);
    expect(incomingBuy.quantity).toBe(5); // Quantity unchanged
  });
}); 