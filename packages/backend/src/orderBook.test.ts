import { OrderBook } from './orderBook';
import { OrderBookOrder } from '@xoro/common';
import { Decimal } from 'decimal.js';

describe('OrderBook', () => {
  let orderBook: OrderBook;

  const buyOrder1: OrderBookOrder = {
    order_id: 'buy1', account_id: 'acc1', pair: 'BTC/USD', type: 'BUY', price: new Decimal(100), quantity: new Decimal(10)
  };
  const buyOrder2: OrderBookOrder = {
    order_id: 'buy2', account_id: 'acc2', pair: 'BTC/USD', type: 'BUY', price: new Decimal(101), quantity: new Decimal(5)
  };
   const buyOrder3_samePrice: OrderBookOrder = {
    order_id: 'buy3', account_id: 'acc3', pair: 'BTC/USD', type: 'BUY', price: new Decimal(100), quantity: new Decimal(8)
  };
  const sellOrder1: OrderBookOrder = {
    order_id: 'sell1', account_id: 'acc3', pair: 'BTC/USD', type: 'SELL', price: new Decimal(102), quantity: new Decimal(12)
  };
  const sellOrder2: OrderBookOrder = {
    order_id: 'sell2', account_id: 'acc4', pair: 'BTC/USD', type: 'SELL', price: new Decimal(101), quantity: new Decimal(6)
  };
  const sellOrder3_samePrice: OrderBookOrder = {
    order_id: 'sell3', account_id: 'acc5', pair: 'BTC/USD', type: 'SELL', price: new Decimal(102), quantity: new Decimal(7)
  };

  beforeEach(() => {
    orderBook = new OrderBook();
  });

  test('should add orders correctly', () => {
    orderBook.addOrder(buyOrder1);
    orderBook.addOrder(sellOrder1);
    expect(orderBook.getOrderById('buy1')?.price.equals(100)).toBe(true);
    expect(orderBook.getOrderById('buy1')?.quantity.equals(10)).toBe(true);
    expect(orderBook.getOrderById('sell1')?.price.equals(102)).toBe(true);
    expect(orderBook.getOrderById('sell1')?.quantity.equals(12)).toBe(true);
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

  test('getOutputOrderBook should return sorted bids and asks as strings', () => {
    orderBook.addOrder({...buyOrder1});
    orderBook.addOrder({...buyOrder2});
    orderBook.addOrder({...buyOrder3_samePrice});
    orderBook.addOrder({...sellOrder1});
    orderBook.addOrder({...sellOrder2});
    orderBook.addOrder({...sellOrder3_samePrice});

    const output = orderBook.getOutputOrderBook();

    const expectedBid2 = { ...buyOrder2, price: buyOrder2.price.toFixed(8), quantity: buyOrder2.quantity.toFixed(8) };
    const expectedBid1 = { ...buyOrder1, price: buyOrder1.price.toFixed(8), quantity: buyOrder1.quantity.toFixed(8) };
    const expectedBid3 = { ...buyOrder3_samePrice, price: buyOrder3_samePrice.price.toFixed(8), quantity: buyOrder3_samePrice.quantity.toFixed(8) };
    const expectedAsk2 = { ...sellOrder2, price: sellOrder2.price.toFixed(8), quantity: sellOrder2.quantity.toFixed(8) };
    const expectedAsk1 = { ...sellOrder1, price: sellOrder1.price.toFixed(8), quantity: sellOrder1.quantity.toFixed(8) };
    const expectedAsk3 = { ...sellOrder3_samePrice, price: sellOrder3_samePrice.price.toFixed(8), quantity: sellOrder3_samePrice.quantity.toFixed(8) };

    expect(output.bids).toEqual([expectedBid2, expectedBid1, expectedBid3]);
    expect(output.asks).toEqual([expectedAsk2, expectedAsk1, expectedAsk3]);
  });

   test('getOutputOrderBook should reflect removed orders', () => {
    orderBook.addOrder({...buyOrder1});
    orderBook.addOrder({...sellOrder1});
    orderBook.removeOrderById('buy1');

    const output = orderBook.getOutputOrderBook();
    const expectedAsk1 = { ...sellOrder1, price: sellOrder1.price.toFixed(8), quantity: sellOrder1.quantity.toFixed(8) };
    expect(output.bids).toEqual([]);
    expect(output.asks).toEqual([expectedAsk1]);
  });

  test('getOutputOrderBook should handle empty price levels after removal', () => {
    orderBook.addOrder({...buyOrder1});
    orderBook.removeOrderById('buy1');
    orderBook.addOrder({...sellOrder1});

    const output = orderBook.getOutputOrderBook();
    const expectedAsk1 = { ...sellOrder1, price: sellOrder1.price.toFixed(8), quantity: sellOrder1.quantity.toFixed(8) };
    expect(output.bids).toEqual([]);
    expect(output.asks).toEqual([expectedAsk1]);

    orderBook.addOrder({...buyOrder2});
    const output2 = orderBook.getOutputOrderBook();
    const expectedBid2 = { ...buyOrder2, price: buyOrder2.price.toFixed(8), quantity: buyOrder2.quantity.toFixed(8) };
    expect(output2.bids).toEqual([expectedBid2]);
    expect(output2.asks).toEqual([expectedAsk1]);
  });

  test('getOutputOrderBook should exclude orders with quantity 0', () => {
    const zeroQuantityOrder: OrderBookOrder = {
      ...buyOrder1, quantity: new Decimal(0)
    };

    // Add a check to see if the warning is called
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    orderBook.addOrder(zeroQuantityOrder);

    expect(consoleWarnSpy).toHaveBeenCalledWith(`[WARN] Order ${zeroQuantityOrder.order_id} has non-positive quantity. Skipping.`);
    consoleWarnSpy.mockRestore();

    orderBook.addOrder({...sellOrder1});

    const output = orderBook.getOutputOrderBook();
    const expectedAsk1 = { ...sellOrder1, price: sellOrder1.price.toFixed(8), quantity: sellOrder1.quantity.toFixed(8) };
    expect(output.bids).toEqual([]);
    expect(output.asks).toEqual([expectedAsk1]);
  });

});

// --- Tests for matchIncomingOrder ---
describe('OrderBook - matchIncomingOrder', () => {
  let orderBook: OrderBook;

  const restingSell: OrderBookOrder = { order_id: 'sell1', account_id: 'accS1', pair: 'BTC/USD', type: 'SELL', price: new Decimal(100), quantity: new Decimal(10) };
  const restingBuy: OrderBookOrder = { order_id: 'buy1', account_id: 'accB1', pair: 'BTC/USD', type: 'BUY', price: new Decimal(95), quantity: new Decimal(10) };
  const restingSellLower: OrderBookOrder = { order_id: 'sell2', account_id: 'accS2', pair: 'BTC/USD', type: 'SELL', price: new Decimal(98), quantity: new Decimal(5) };
  const restingBuyHigher: OrderBookOrder = { order_id: 'buy2', account_id: 'accB2', pair: 'BTC/USD', type: 'BUY', price: new Decimal(97), quantity: new Decimal(5) };

  beforeEach(() => {
    orderBook = new OrderBook();
    orderBook.addOrder({...restingSell});
    orderBook.addOrder({...restingBuy});
    orderBook.addOrder({...restingSellLower});
    orderBook.addOrder({...restingBuyHigher});
  });

  test('incoming buy should fully fill the best ask', () => {
    const incomingBuy: OrderBookOrder = { order_id: 'newBuy1', account_id: 'accNB1', pair: 'BTC/USD', type: 'BUY', price: new Decimal(98), quantity: new Decimal(5) };
    const trades = orderBook.matchIncomingOrder({...incomingBuy});

    expect(trades).toHaveLength(1);
    expect(trades[0].price.equals(98)).toBe(true);
    expect(trades[0].quantity.equals(5)).toBe(true);
    expect(trades[0].buyOrderId).toBe('newBuy1');
    expect(trades[0].sellOrderId).toBe('sell2');

    const finalIncomingState = orderBook.getOrderById('newBuy1');
    expect(finalIncomingState).toBeUndefined();

    expect(orderBook.getOrderById('sell2')).toBeUndefined();
    expect(orderBook.getOrderById('sell1')?.quantity.equals(10)).toBe(true);
  });

  test('incoming sell should partially fill the best bid', () => {
    const incomingSell: OrderBookOrder = { order_id: 'newSell1', account_id: 'accNS1', pair: 'BTC/USD', type: 'SELL', price: new Decimal(97), quantity: new Decimal(3) };
    const trades = orderBook.matchIncomingOrder({...incomingSell});

    expect(trades).toHaveLength(1);
    expect(trades[0].price.equals(97)).toBe(true);
    expect(trades[0].quantity.equals(3)).toBe(true);
    expect(trades[0].buyOrderId).toBe('buy2');
    expect(trades[0].sellOrderId).toBe('newSell1');

    const finalIncomingState = orderBook.getOrderById('newSell1');
    expect(finalIncomingState).toBeUndefined();

    expect(orderBook.getOrderById('buy2')?.quantity.equals(2)).toBe(true);
    expect(orderBook.getOrderById('buy1')?.quantity.equals(10)).toBe(true);
  });

  test('incoming buy should fill multiple asks', () => {
    const incomingBuy: OrderBookOrder = { order_id: 'newBuy2', account_id: 'accNB2', pair: 'BTC/USD', type: 'BUY', price: new Decimal(100), quantity: new Decimal(12) };
    const trades = orderBook.matchIncomingOrder({...incomingBuy});

    expect(trades).toHaveLength(2);
    expect(trades[0].price.equals(98)).toBe(true);
    expect(trades[0].quantity.equals(5)).toBe(true);
    expect(trades[0].sellOrderId).toBe('sell2');
    expect(trades[1].price.equals(100)).toBe(true);
    expect(trades[1].quantity.equals(7)).toBe(true);
    expect(trades[1].sellOrderId).toBe('sell1');

    const finalIncomingState = orderBook.getOrderById('newBuy2');
    expect(finalIncomingState).toBeUndefined();

    expect(orderBook.getOrderById('sell2')).toBeUndefined();
    expect(orderBook.getOrderById('sell1')?.quantity.equals(3)).toBe(true);
  });

  test('incoming order should not match if price is not met', () => {
    const incomingBuy: OrderBookOrder = { order_id: 'newBuy3', account_id: 'accNB3', pair: 'BTC/USD', type: 'BUY', price: new Decimal(90), quantity: new Decimal(5) };
    const incomingBuyCopy = {...incomingBuy};
    const trades = orderBook.matchIncomingOrder(incomingBuyCopy);

    expect(trades).toHaveLength(0);

    const finalIncomingState = orderBook.getOrderById('newBuy3');
    expect(finalIncomingState).toBeDefined();
    expect(finalIncomingState?.quantity.equals(5)).toBe(true);
    expect(finalIncomingState?.price.equals(90)).toBe(true);

    expect(orderBook.getOrderById('sell1')?.quantity.equals(10)).toBe(true);
    expect(orderBook.getOrderById('sell2')?.quantity.equals(5)).toBe(true);
  });

  test('incoming order should not match if no opposite side orders exist', () => {
    orderBook.removeOrderById('sell1');
    orderBook.removeOrderById('sell2');

    const incomingBuy: OrderBookOrder = { order_id: 'newBuy4', account_id: 'accNB4', pair: 'BTC/USD', type: 'BUY', price: new Decimal(100), quantity: new Decimal(5) };
    const incomingBuyCopy = {...incomingBuy};
    const trades = orderBook.matchIncomingOrder(incomingBuyCopy);

    expect(trades).toHaveLength(0);

    const finalIncomingState = orderBook.getOrderById('newBuy4');
    expect(finalIncomingState).toBeDefined();
    expect(finalIncomingState?.quantity.equals(5)).toBe(true);
  });

  // --- Tests for Self-Trade Prevention ---

  test('should prevent self-trade: incoming buy matches own resting sell', () => {
    const selfTradeAccount = 'selfTrader';
    const restingSellSelf: OrderBookOrder = { order_id: 'sellSelf', account_id: selfTradeAccount, pair: 'BTC/USD', type: 'SELL', price: new Decimal(99), quantity: new Decimal(10) };
    orderBook.addOrder({...restingSellSelf});

    const incomingBuySelf: OrderBookOrder = { order_id: 'buySelf', account_id: selfTradeAccount, pair: 'BTC/USD', type: 'BUY', price: new Decimal(99), quantity: new Decimal(5) };
    const incomingBuySelfCopy = {...incomingBuySelf};
    const trades = orderBook.matchIncomingOrder(incomingBuySelfCopy);

    expect(trades).toHaveLength(1);
    expect(trades[0].price.equals(98)).toBe(true);
    expect(trades[0].quantity.equals(5)).toBe(true);
    expect(trades[0].buyOrderId).toBe('buySelf');
    expect(trades[0].sellOrderId).toBe('sell2');

    const finalIncomingState = orderBook.getOrderById('buySelf');
    expect(finalIncomingState).toBeUndefined();

    expect(orderBook.getOrderById('sellSelf')?.quantity.equals(10)).toBe(true);
    expect(orderBook.getOrderById('sell1')?.quantity.equals(10)).toBe(true);
    expect(orderBook.getOrderById('sell2')).toBeUndefined();
  });

  test('should prevent self-trade: incoming sell matches own resting buy', () => {
    const selfTradeAccount = 'selfTrader';
    const restingBuySelf: OrderBookOrder = { order_id: 'buySelf', account_id: selfTradeAccount, pair: 'BTC/USD', type: 'BUY', price: new Decimal(96), quantity: new Decimal(10) };
    orderBook.addOrder({...restingBuySelf});

    const incomingSellSelf: OrderBookOrder = { order_id: 'sellSelf', account_id: selfTradeAccount, pair: 'BTC/USD', type: 'SELL', price: new Decimal(96), quantity: new Decimal(5) };
    const incomingSellSelfCopy = {...incomingSellSelf};
    const trades = orderBook.matchIncomingOrder(incomingSellSelfCopy);

    expect(trades).toHaveLength(1);
    expect(trades[0].price.equals(97)).toBe(true);
    expect(trades[0].quantity.equals(5)).toBe(true);
    expect(trades[0].buyOrderId).toBe('buy2');
    expect(trades[0].sellOrderId).toBe('sellSelf');

    const finalIncomingState = orderBook.getOrderById('sellSelf');
    expect(finalIncomingState).toBeUndefined();

    expect(orderBook.getOrderById('buySelf')?.quantity.equals(10)).toBe(true);
    expect(orderBook.getOrderById('buy1')?.quantity.equals(10)).toBe(true);
    expect(orderBook.getOrderById('buy2')).toBeUndefined();
  });

   test('should allow trade when accounts differ, even if price matches potential self-trade', () => {
    const selfTradeAccount = 'selfTrader';
    const otherAccount = 'otherTrader';
    const restingSellSelf: OrderBookOrder = { order_id: 'sellSelf', account_id: selfTradeAccount, pair: 'BTC/USD', type: 'SELL', price: new Decimal(99), quantity: new Decimal(10) };
    orderBook.addOrder({...restingSellSelf});

    const incomingBuyOther: OrderBookOrder = { order_id: 'buyOther', account_id: otherAccount, pair: 'BTC/USD', type: 'BUY', price: new Decimal(99), quantity: new Decimal(5) };
    const trades = orderBook.matchIncomingOrder({...incomingBuyOther});

    expect(trades).toHaveLength(1);
    expect(trades[0].price.equals(98)).toBe(true);
    expect(trades[0].quantity.equals(5)).toBe(true);
    expect(trades[0].buyOrderId).toBe('buyOther');
    expect(trades[0].sellOrderId).toBe('sell2');

    const finalIncomingState = orderBook.getOrderById('buyOther');
    expect(finalIncomingState).toBeUndefined();

    expect(orderBook.getOrderById('sellSelf')?.quantity.equals(10)).toBe(true);
    expect(orderBook.getOrderById('sell2')).toBeUndefined();
  });

});

describe('OrderBook - loadFromOutput', () => {
  let orderBook: OrderBook;

  beforeEach(() => {
    orderBook = new OrderBook();
  });

  test('should load orders from OrderBookOutput', () => {
    const output = {
      bids: [
        {
          order_id: 'bid1',
          account_id: 'acc1',
          pair: 'BTC/USD',
          type: 'BUY' as const,
          price: '100.50',
          quantity: '5.75'
        },
        {
          order_id: 'bid2',
          account_id: 'acc2',
          pair: 'BTC/USD',
          type: 'BUY' as const,
          price: '99.75',
          quantity: '3.25'
        }
      ],
      asks: [
        {
          order_id: 'ask1',
          account_id: 'acc3',
          pair: 'BTC/USD',
          type: 'SELL' as const,
          price: '101.25',
          quantity: '2.50'
        },
        {
          order_id: 'ask2',
          account_id: 'acc4',
          pair: 'BTC/USD',
          type: 'SELL' as const,
          price: '102.00',
          quantity: '4.00'
        }
      ]
    };

    orderBook.loadFromOutput(output);

    const bid1 = orderBook.getOrderById('bid1');
    const bid2 = orderBook.getOrderById('bid2');
    const ask1 = orderBook.getOrderById('ask1');
    const ask2 = orderBook.getOrderById('ask2');

    // Verify bid1
    expect(bid1).toBeDefined();
    expect(bid1?.order_id).toBe('bid1');
    expect(bid1?.account_id).toBe('acc1');
    expect(bid1?.pair).toBe('BTC/USD');
    expect(bid1?.type).toBe('BUY');
    expect(bid1?.price.equals(new Decimal('100.50'))).toBe(true);
    expect(bid1?.quantity.equals(new Decimal('5.75'))).toBe(true);

    // Verify bid2
    expect(bid2).toBeDefined();
    expect(bid2?.price.equals(new Decimal('99.75'))).toBe(true);
    expect(bid2?.quantity.equals(new Decimal('3.25'))).toBe(true);

    // Verify ask1
    expect(ask1).toBeDefined();
    expect(ask1?.price.equals(new Decimal('101.25'))).toBe(true);
    expect(ask1?.quantity.equals(new Decimal('2.50'))).toBe(true);

    // Verify ask2
    expect(ask2).toBeDefined();
    expect(ask2?.price.equals(new Decimal('102.00'))).toBe(true);
    expect(ask2?.quantity.equals(new Decimal('4.00'))).toBe(true);

    // Verify the book structure (via getOutputOrderBook) matches the input
    const reloadedOutput = orderBook.getOutputOrderBook();
    expect(reloadedOutput.bids.length).toBe(2);
    expect(reloadedOutput.asks.length).toBe(2);

    const findOrder = (orders: any[], id: string) => orders.find(o => o.order_id === id);
    
    const outputBid1 = findOrder(reloadedOutput.bids, 'bid1');
    expect(outputBid1).toBeDefined();
    expect(outputBid1?.price).toBe(new Decimal('100.50').toFixed(8));
    
    const outputAsk1 = findOrder(reloadedOutput.asks, 'ask1');
    expect(outputAsk1).toBeDefined();
    expect(outputAsk1?.price).toBe(new Decimal('101.25').toFixed(8));
  });

  test('should clear existing orders when loading from output', () => {
    const initialBuy: OrderBookOrder = {
      order_id: 'initial_buy', account_id: 'acc1', pair: 'BTC/USD', 
      type: 'BUY', price: new Decimal(90), quantity: new Decimal(10)
    };
    orderBook.addOrder(initialBuy);

    // Verify initial state
    expect(orderBook.getOrderById('initial_buy')).toBeDefined();

    // Create new output with different orders
    const output = {
      bids: [
        {
          order_id: 'new_bid',
          account_id: 'acc2',
          pair: 'BTC/USD',
          type: 'BUY' as const,
          price: '95.00',
          quantity: '2.00'
        }
      ],
      asks: []
    };

    // Load from the new output
    orderBook.loadFromOutput(output);

    // Verify old orders are gone
    expect(orderBook.getOrderById('initial_buy')).toBeUndefined();
    
    // Verify new orders exist
    const newBid = orderBook.getOrderById('new_bid');
    expect(newBid).toBeDefined();
    expect(newBid?.price.equals(new Decimal('95.00'))).toBe(true);
  });

  test('should handle invalid price/quantity values gracefully', () => {
    // Create output with some invalid values
    const output = {
      bids: [
        {
          order_id: 'valid_bid',
          account_id: 'acc1',
          pair: 'BTC/USD',
          type: 'BUY' as const,
          price: '100.00',
          quantity: '5.00'
        },
        {
          order_id: 'invalid_price',
          account_id: 'acc2',
          pair: 'BTC/USD',
          type: 'BUY' as const,
          price: 'invalid',
          quantity: '3.00'
        },
        {
          order_id: 'zero_quantity',
          account_id: 'acc3',
          pair: 'BTC/USD',
          type: 'BUY' as const,
          price: '99.00',
          quantity: '0'
        }
      ],
      asks: []
    };

    // Mock console.warn to verify warnings
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Load the output
    orderBook.loadFromOutput(output);

    // Verify valid order was loaded
    expect(orderBook.getOrderById('valid_bid')).toBeDefined();
    
    // Verify invalid orders were not loaded
    expect(orderBook.getOrderById('invalid_price')).toBeUndefined();
    expect(orderBook.getOrderById('zero_quantity')).toBeUndefined();
    
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });
});