import { Decimal } from 'decimal.js';

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
  type: 'BUY' | 'SELL';
  price: Decimal;
  quantity: Decimal;
}

export interface Trade {
  tradeId: string;
  buyOrderId: string;
  sellOrderId: string;
  price: Decimal;
  quantity: Decimal;
  timestamp: number;
}

export interface OrderBookOutput {
  bids: OutputOrder[];
  asks: OutputOrder[];
}

// Interface for the final stringified output
export interface OutputOrder {
  order_id: string;
  account_id: string;
  pair: string;
  type: 'BUY' | 'SELL';
  price: string;
  quantity: string;
}
