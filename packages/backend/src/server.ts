import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { MatchingEngine } from './matchingEngine';
import { OrderBookOutput, Trade, IncomingOperation, OutputOrder } from '@xoro/common';
import { Decimal } from 'decimal.js';

// Server setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;
const IO_DIR = path.resolve(__dirname, '..', '..', '..', 'io');
const DATA_DIR = path.join(IO_DIR, 'output');
const ORDERBOOK_FILE = path.join(DATA_DIR, 'orderbook.json');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');

// Persistent State
const matchingEngine = new MatchingEngine();
let trades: Trade[] = [];

// Utility Functions

const serializeTrades = (tradesToSerialize: Trade[]): any[] => {
    return tradesToSerialize.map(trade => ({
        ...trade,
        price: trade.price.toFixed(8),
        quantity: trade.quantity.toFixed(8),
    }));
};

const broadcast = (data: any) => {
    if (data.type === 'trades' && Array.isArray(data.payload)) {
        data.payload = serializeTrades(data.payload);
    } else if (data.type === 'orderbook' && data.payload) {
        // Orderbook output from getOutputOrderBook already has strings
    }
    const jsonData = JSON.stringify(data);
    wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
        }
    });
};


const loadInitialData = async () => {
    try {
        const orderBookData = await fs.readFile(ORDERBOOK_FILE, 'utf-8');
        const orderBookOutput: OrderBookOutput = JSON.parse(orderBookData);
        matchingEngine.loadFromOutput(orderBookOutput);
        console.log(`Loaded initial order book from ${ORDERBOOK_FILE}`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`[WARN] Order book file not found at ${ORDERBOOK_FILE}. Starting with an empty order book.`);
        } else {
            console.error(`[ERROR] Error loading order book from ${ORDERBOOK_FILE}:`, error);
        }
    }

    try {
        const tradesData = await fs.readFile(TRADES_FILE, 'utf-8');
        const rawTrades: any[] = JSON.parse(tradesData);
        trades = rawTrades.map((rawTrade: any): Trade => {
             if (!rawTrade.price || !rawTrade.quantity) {
                 throw new Error(`Invalid trade format in ${TRADES_FILE}: Missing price or quantity`);
             }
             try {
                const price = new Decimal(rawTrade.price);
                const quantity = new Decimal(rawTrade.quantity);
                 if (price.isNaN() || quantity.isNaN()) {
                    throw new Error(`Invalid Decimal value in trade: ${rawTrade.tradeId}`);
                 }
                return {
                    ...rawTrade,
                    price: price,
                    quantity: quantity,
                     timestamp: typeof rawTrade.timestamp === 'string' ? Date.parse(rawTrade.timestamp) : Number(rawTrade.timestamp),
                } as Trade;
            } catch (e) {
                 console.error(`[ERROR] Failed to parse Decimal in trade ${rawTrade?.tradeId || 'unknown'} from ${TRADES_FILE}:`, e);
                 throw e;
            }
        });
        console.log(`Loaded ${trades.length} initial trades from ${TRADES_FILE}`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`[WARN] Trades file not found at ${TRADES_FILE}. Starting with empty trades list.`);
        } else {
            console.error(`[ERROR] Error loading trades from ${TRADES_FILE}:`, error);
            trades = [];
        }
    }
};

// Middleware
app.use(cors());
app.use(express.json());

// API Endpoints

// @ts-ignore
app.get('/api/orderbook', ((req: Request, res: Response) => {
    try {
        const orderBookOutput = matchingEngine.getOutputOrderBook();
        return res.json(orderBookOutput);
    } catch (error) {
        console.error("[ERROR] Failed to get order book:", error);
        return res.status(500).json({ error: "Failed to retrieve order book" });
    }
}) as RequestHandler);

// @ts-ignore
app.get('/api/trades', ((req: Request, res: Response) => {
    try {
        const outputTrades = serializeTrades(trades);
        return res.json(outputTrades);
    } catch (error) {
        console.error("[ERROR] Failed to get trades:", error);
        return res.status(500).json({ error: "Failed to retrieve trades" });
    }
}) as RequestHandler);

// @ts-ignore
app.post('/api/submit-order', ((req: Request, res: Response, next: NextFunction) => {
    const orderData = req.body as Partial<IncomingOperation>;

    if (!orderData || typeof orderData !== 'object') {
        return res.status(400).json({ error: 'Invalid request body: Expected a JSON object.' });
    }

    const requiredFields: (keyof IncomingOperation)[] = ['order_id', 'account_id', 'pair', 'side', 'amount', 'limit_price'];
    const missingFields = requiredFields.filter(field => !(field in orderData) || orderData[field] === undefined || String(orderData[field]).trim() === '');
    if (missingFields.length > 0) {
        return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    const side = String(orderData.side).toUpperCase();
    if (side !== 'BUY' && side !== 'SELL') {
        return res.status(400).json({ error: 'Invalid side: Must be "BUY" or "SELL"' });
    }

    let amountDecimal: Decimal;
    let priceDecimal: Decimal;

    try {
        amountDecimal = new Decimal(orderData.amount!);
        if (amountDecimal.isNaN() || amountDecimal.isNegative() || amountDecimal.isZero()) {
            throw new Error('Amount must be a positive number.');
        }
    } catch (e: any) {
        return res.status(400).json({ error: `Invalid amount: ${e.message || 'Must be a positive number.'}` });
    }

    try {
        priceDecimal = new Decimal(orderData.limit_price!);
         if (priceDecimal.isNaN() || priceDecimal.isNegative() || priceDecimal.isZero()) {
            throw new Error('Price must be a positive number.');
        }
    } catch (e: any) {
        return res.status(400).json({ error: `Invalid limit_price: ${e.message || 'Must be a positive number.'}` });
    }

    const operation: IncomingOperation = {
        type_op: 'CREATE',
        order_id: String(orderData.order_id),
        account_id: String(orderData.account_id),
        pair: String(orderData.pair),
        side: side as 'BUY' | 'SELL',
        amount: orderData.amount!,
        limit_price: orderData.limit_price!,
    };

    try {
        const newTrades = matchingEngine.processOperation(operation);
        trades.push(...newTrades);

        const currentOrderBook = matchingEngine.getOutputOrderBook();
        if (newTrades.length > 0) {
            broadcast({ type: 'trades', payload: newTrades });
        }
        broadcast({ type: 'orderbook', payload: currentOrderBook });

        console.log(`[INFO] Processed order ${operation.order_id}. New trades: ${newTrades.length}`);
        return res.status(200).json({ message: 'Order processed successfully', trades: serializeTrades(newTrades) });

    } catch (error: any) {
        console.error(`[ERROR] Error processing order ${operation.order_id}:`, error);
        return res.status(500).json({ error: 'Internal server error: Failed to process order' });
    }
}) as RequestHandler);

// @ts-ignore
app.post('/api/cancel-order', ((req: Request, res: Response) => {
    const { order_id } = req.body as { order_id?: string };

    // --- Input Validation ---
    if (!order_id || typeof order_id !== 'string' || order_id.trim() === '') {
        return res.status(400).json({ error: 'Missing or invalid required field: order_id (must be a non-empty string)' });
    }
    // --- End Validation ---

    const operation: IncomingOperation = {
        type_op: 'DELETE',
        order_id: order_id.trim(),
        // Other fields are not needed for DELETE
        account_id: '', // Provide default or dummy values if type requires them
        pair: '',
        side: 'BUY', // Dummy value
        amount: '0', // Dummy value
        limit_price: '0' // Dummy value
    };

    try {
        // Process the cancellation - MatchingEngine handles the logic
        // DELETE operation usually doesn't return trades, but it modifies the book
        matchingEngine.processOperation(operation);

        // Broadcast the updated order book state
        const currentOrderBook = matchingEngine.getOutputOrderBook();
        broadcast({ type: 'orderbook', payload: currentOrderBook });

        console.log(`[INFO] Processed cancellation for order ${operation.order_id}.`);
        return res.status(200).json({ message: `Order ${order_id} cancelled successfully` });

    } catch (error: any) {
        // Catch potential errors from processOperation if it throws for DELETE
        // (e.g., order not found, though current implementation might not throw)
        console.error(`[ERROR] Error processing cancellation for order ${operation.order_id}:`, error);
        // Check if the error is about the order not being found (if engine provides such info)
        // if (error.message === 'ORDER_NOT_FOUND') {
        //     return res.status(404).json({ error: `Order ${order_id} not found` });
        // }
        return res.status(500).json({ error: 'Internal server error: Failed to cancel order' });
    }
}) as RequestHandler);


// WebSocket Handling
wss.on('connection', (ws: WebSocket) => {
    console.log('[INFO] WebSocket client connected');

    try {
        ws.send(JSON.stringify({ type: 'orderbook', payload: matchingEngine.getOutputOrderBook() }));
        ws.send(JSON.stringify({ type: 'trades', payload: serializeTrades(trades) }));
        console.log('[INFO] Sent initial state to newly connected client.');
    } catch (error) {
        console.error("[ERROR] Error sending initial state to WebSocket client:", error);
         try { ws.close(); } catch (closeError) { /* ignore */ }
    }


    ws.on('message', (message: Buffer) => {
        console.log('[INFO] Received WebSocket message (not processed): %s', message.toString());
        // Example: ws.send(JSON.stringify({ type: 'ack', message: 'Received your message' }));
    });

    ws.on('close', () => {
        console.log('[INFO] WebSocket client disconnected');
    });

    ws.on('error', (error: Error) => {
        console.error('[ERROR] WebSocket client error:', error);
    });
});

// Start Server
const startServer = async () => {
    console.log(`[INFO] Initializing server...`);
    console.log(`[INFO] Data directory (expected): ${DATA_DIR}`);
    await loadInitialData();
    server.listen(PORT, () => {
        console.log(`[INFO] HTTP Server listening on port ${PORT}`);
        console.log(`[INFO] WebSocket server listening on port ${PORT}`);
    });
};

startServer().catch(error => {
    console.error("[FATAL] Failed to start server:", error);
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('[INFO] SIGTERM signal received: closing server...');
    wss.close(() => {
        console.log('[INFO] WebSocket server closed.');
        server.close(() => {
            console.log('[INFO] HTTP server closed.');
            process.exit(0);
        });
    });

    setTimeout(() => {
        console.error('[ERROR] Could not close connections gracefully, forcing shutdown.');
        process.exit(1);
    }, 10000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});