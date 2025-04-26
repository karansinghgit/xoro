import { OrderBookOrder } from '@xoro/common';

export class OrderBook {
  private priceLevels: Map<number, OrderBookOrder[]>;

  private orderById: Map<string, OrderBookOrder>;

  constructor() {
    this.priceLevels = new Map<number, OrderBookOrder[]>();
    this.orderById = new Map<string, OrderBookOrder>();
  }
}
