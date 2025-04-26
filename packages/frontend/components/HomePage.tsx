'use client';

import React, { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';
import { OrderBookOutput, Trade, OutputOrder, IncomingOperation } from '@xoro/common';
import { useWebSocket, WebSocketStatus } from '../hooks/useWebSocket';

const formatNumber = (numStr: string | number, decimals: number) => {
    try {
        return parseFloat(numStr.toString()).toFixed(decimals);
    } catch {
        return numStr;
    }
};

interface OrderTableProps {
    bids: OutputOrder[];
    asks: OutputOrder[];
}

const OrderTable: React.FC<OrderTableProps> = ({ bids, asks }) => {
    return (
        <div className={`${styles.section} ${styles.orderBookSection}`}>
            <h2>Order Book</h2>
            <div className={styles.orderBookContainer}>
                <div className={styles.orderBookSide}>
                    <h3>Bids (Buy Orders)</h3>
                    <table className={styles.dataTable}>
                        <thead>
                            <tr>
                                <th>Price (USDC)</th>
                                <th>Quantity (BTC)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bids.length > 0 ? (
                                bids.slice(0, 15).map(order => (
                                    <tr key={order.order_id} className={styles.bidRow}>
                                        <td className={styles.bidPrice}>{formatNumber(order.price, 2)}</td>
                                        <td>{formatNumber(order.quantity, 8)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={2}>No bids</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className={styles.orderBookSide}>
                    <h3>Asks (Sell Orders)</h3>
                     <table className={styles.dataTable}>
                         <thead>
                            <tr>
                                <th>Price (USDC)</th>
                                <th>Quantity (BTC)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {asks.length > 0 ? (
                                asks.slice(0, 15).sort((a, b) => parseFloat(a.price) - parseFloat(b.price)).map(order => (
                                    <tr key={order.order_id} className={styles.askRow}>
                                        <td className={styles.askPrice}>{formatNumber(order.price, 2)}</td>
                                        <td>{formatNumber(order.quantity, 8)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={2}>No asks</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

interface TradesTableProps {
    trades: Trade[];
}

const TradesTable: React.FC<TradesTableProps> = ({ trades }) => {
    const recentTrades = trades.slice(0, 20);

    return (
        <div className={`${styles.section} ${styles.tradesSection}`}>
            <h2>Recent Trades</h2>
            <table className={`${styles.dataTable} ${styles.tradesTable}`}> 
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Price (USDC)</th>
                        <th>Quantity (BTC)</th>
                    </tr>
                </thead>
                <tbody>
                    {recentTrades.length > 0 ? (
                        recentTrades.map(trade => (
                            <tr key={trade.tradeId}>
                                <td>{new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}</td>
                                <td>{formatNumber(trade.price, 2)}</td>
                                <td>{formatNumber(trade.quantity, 8)}</td>
                            </tr>
                        ))
                    ) : (
                         <tr><td colSpan={3}>No recent trades</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

interface OrderFormProps {
    onSubmit: (order: Omit<IncomingOperation, 'type_op' | 'order_id' | 'account_id'>) => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ onSubmit }) => {
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
    const [amount, setAmount] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [pair, setPair] = useState<string>('BTC/USDC');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !price || isNaN(parseFloat(amount)) || isNaN(parseFloat(price))) {
            alert('Please enter valid amount and price.');
            return;
        }
        onSubmit({ side, amount, limit_price: price, pair });
    };

    return (
        <div className={`${styles.section} ${styles.orderFormSection}`}>
            <h2>Submit New Order</h2>
            <form onSubmit={handleSubmit} className={styles.orderForm}>
                <div className={styles.formGroup}>
                    <label htmlFor="pair">Pair:</label>
                    <select id="pair" value={pair} onChange={(e) => setPair(e.target.value)} disabled>
                        <option value="BTC/USDC">BTC/USDC</option>
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="side">Side:</label>
                    <select id="side" value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
                        <option value="BUY">Buy</option>
                        <option value="SELL">Sell</option>
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="amount">Amount (BTC):</label>
                    <input id="amount" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 0.1" required />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="price">Limit Price (USDC):</label>
                    <input id="price" type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g., 50000" required />
                </div>
                <button type="submit" className={`${styles.submitButton} ${side === 'BUY' ? styles.buyButton : styles.sellButton}`}>
                     Submit {side} Order
                 </button>
            </form>
        </div>
    );
};

const HomePage: React.FC = () => {
    const [orderBook, setOrderBook] = useState<OrderBookOutput>({ bids: [], asks: [] });
    const [trades, setTrades] = useState<Trade[]>([]);
    const [error, setError] = useState<string | null>(null);

    const wsUrl = 'ws://localhost:3001'; // Define WebSocket URL
    const { status: wsStatus, lastMessage } = useWebSocket(wsUrl);

    const processTradeData = (tradeData: any): Trade => ({
        ...tradeData,
        price: String(tradeData.price),
        quantity: String(tradeData.quantity),
        timestamp: new Date(tradeData.timestamp).getTime(),
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setError(null);
                const [orderBookRes, tradesRes] = await Promise.all([
                    fetch('http://localhost:3001/api/orderbook'),
                    fetch('http://localhost:3001/api/trades')
                ]);

                if (!orderBookRes.ok || !tradesRes.ok) {
                    throw new Error(`API Error: ${orderBookRes.status}, ${tradesRes.status}`);
                }

                const orderBookData: OrderBookOutput = await orderBookRes.json();
                const tradesData: any[] = await tradesRes.json();

                // Basic validation (optional, but good practice)
                if (!Array.isArray(orderBookData?.bids) || !Array.isArray(orderBookData?.asks)) {
                    throw new Error('Received invalid order book data from API.');
                }
                if (!Array.isArray(tradesData)) {
                    throw new Error('Received invalid trades data from API.');
                }

                const processedTrades: Trade[] = tradesData.map(processTradeData);

                setOrderBook(orderBookData);
                setTrades(processedTrades.sort((a, b) => b.timestamp - a.timestamp)); // Sort initial trades

            } catch (err: any) {
                console.error('Failed to fetch initial data:', err);
                setError(`Failed to load data: ${err.message}. Is the backend running?`);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (lastMessage) {
            try {
                if (lastMessage.type === 'orderbook' && lastMessage.payload) {
                     if (!Array.isArray(lastMessage.payload?.bids) || !Array.isArray(lastMessage.payload?.asks)) {
                        console.error("Invalid order book structure from WS:", lastMessage.payload);
                        return;
                    }
                    setOrderBook(lastMessage.payload as OrderBookOutput);
                } else if (lastMessage.type === 'trades' && lastMessage.payload) {
                    const newTradesPayload = Array.isArray(lastMessage.payload) ? lastMessage.payload : [lastMessage.payload];
                    if (newTradesPayload.length === 0) return;

                    const newValidTrades: Trade[] = newTradesPayload
                        .map(processTradeData)
                        .filter((trade: Trade) => trade.tradeId && !isNaN(trade.timestamp));

                    if (newValidTrades.length === 0) return;

                    setTrades(prevTrades => {
                        const combinedValidTrades = [
                            ...newValidTrades,
                            ...prevTrades.filter((trade: Trade) => trade.tradeId && !isNaN(trade.timestamp))
                        ];

                        const uniqueTrades = Array.from(
                            new Map(combinedValidTrades.map(trade => [trade.tradeId, trade])).values()
                        );

                        const sortedTrades = uniqueTrades.sort((a, b) => b.timestamp - a.timestamp);
                        const latestTrades = sortedTrades.slice(0, 50);
                        return latestTrades;
                    });
                }
            } catch (e) {
                console.error('Failed to process WebSocket message or update state:', e);
            }
        }
    }, [lastMessage]);

    useEffect(() => {
        if (wsStatus === 'open') {
            setError(null);
        } else if (wsStatus === 'error') {
            setError('WebSocket connection error. Check console or backend.');
        } else if (wsStatus === 'closed') {
            setError('WebSocket disconnected. May attempt to reconnect...');
        }
    }, [wsStatus]);

    const handleOrderSubmit = async (orderData: Omit<IncomingOperation, 'type_op' | 'order_id' | 'account_id'>) => {
        console.log("Submitting order:", orderData);
        try {
            const response = await fetch('http://localhost:3001/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...orderData,
                    type_op: 'NEW_ORDER',
                    account_id: 'user123',
                    pair: orderData.pair
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to submit order: ${response.status}`);
            }

            const result = await response.json();
            console.log('Order submitted successfully:', result);
            // Optionally: Show success message to user, clear form, update state etc.

        } catch (err: any) {
            console.error('Error submitting order:', err);
            setError(err.message || 'Failed to submit order.');
            // Optionally: Show error message to user
        }
    };

    const getStatusText = (status: WebSocketStatus) => {
        switch (status) {
            case 'connecting': return <span style={{color: '#ffa500'}}>Connecting...</span>;
            case 'open': return <span style={{color: '#2ecc71'}}>Connected</span>;
            case 'closed': return <span style={{color: '#e74c3c'}}>Disconnected</span>;
            case 'error': return <span style={{color: '#e74c3c', fontWeight: 'bold'}}>Error</span>;
            default: return <span style={{color: '#95a5a6'}}>Unknown</span>;
        }
    }

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Xoro Trading</h1>
                    <div className={styles.statusIndicator}>
                         <span>WebSocket: {getStatusText(wsStatus)}</span>
                         {error && <span className={styles.errorText}> | Error: {error}</span>}
                    </div>
                 </div>

                <div className={styles.contentGrid}>
                    <OrderForm onSubmit={handleOrderSubmit} />
                    <OrderTable bids={orderBook.bids} asks={orderBook.asks} />
                    <TradesTable trades={trades} />
                </div>

            </main>
        </div>
    );
};

export default HomePage; 