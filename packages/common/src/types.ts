export interface IncomingOperation {
  type_op: 'CREATE' | 'DELETE';
  account_id: string;
  amount: string;
  order_id: string;
  pair: string;
  limit_price: string;
  side: 'BUY' | 'SELL';
}

export interface OrderBookOrder {
  order_id: string;
  account_id: string;
  pair: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
}

export interface Trade {
  tradeId: string;
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  quantity: number;
  timestamp: number;
}

export interface OrderBookOutput {
  bids: OrderBookOrder[];
  asks: OrderBookOrder[];
}
