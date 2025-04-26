import { promises as fs } from 'fs';
import path from 'path';
import { MatchingEngine } from './matchingEngine';
import { IncomingOperation, Trade, OrderBookOutput } from '@xoro/common';
import { Decimal } from 'decimal.js';

// Validation function for IncomingOperation
function validateOperation(operation: any, index: number): operation is IncomingOperation {
    const operationId = operation?.order_id || `at index ${index}`;

    if (!operation || typeof operation !== 'object') {
        console.warn(`[WARN] Operation at index ${index} is not a valid object. Skipping.`);
        return false;
    }

    if (typeof operation.type_op !== 'string' || !['CREATE', 'DELETE'].includes(operation.type_op)) {
        console.warn(`[WARN] Invalid or missing 'type_op' for operation ${operationId}. Skipping.`);
        return false;
    }

    if (typeof operation.order_id !== 'string' || operation.order_id.trim() === '') {
        console.warn(`[WARN] Invalid or missing 'order_id' for operation ${operationId}. Skipping.`);
        return false;
    }

    if (operation.type_op === 'CREATE') {
        if (typeof operation.pair !== 'string' || operation.pair.trim() === '') {
            console.warn(`[WARN] Invalid or missing 'pair' for CREATE operation ${operationId}. Skipping.`);
            return false;
        }
        if (typeof operation.side !== 'string' || !['BUY', 'SELL'].includes(operation.side)) {
            console.warn(`[WARN] Invalid or missing 'side' for CREATE operation ${operationId}. Skipping.`);
            return false;
        }
        if (typeof operation.amount !== 'string' || operation.amount.trim() === '') {
             console.warn(`[WARN] Missing or empty 'amount' for CREATE operation ${operationId}. Skipping.`);
            return false;
        }
         if (typeof operation.limit_price !== 'string' || operation.limit_price.trim() === '') {
             console.warn(`[WARN] Missing or empty 'limit_price' for CREATE operation ${operationId}. Skipping.`);
            return false;
        }

        try {
            const amount = new Decimal(operation.amount);
            if (amount.isNaN() || amount.isNegative() || amount.isZero()) {
                 console.warn(`[WARN] Invalid 'amount' (must be positive number) for CREATE operation ${operationId}. Found: '${operation.amount}'. Skipping.`);
                return false;
            }
        } catch (e) {
             console.warn(`[WARN] Cannot parse 'amount' as number for CREATE operation ${operationId}. Found: '${operation.amount}'. Skipping.`);
            return false;
        }

        try {
            const price = new Decimal(operation.limit_price);
             if (price.isNaN() || price.isNegative() || price.isZero()) {
                 console.warn(`[WARN] Invalid 'limit_price' (must be positive number) for CREATE operation ${operationId}. Found: '${operation.limit_price}'. Skipping.`);
                return false;
            }
        } catch (e) {
            console.warn(`[WARN] Cannot parse 'limit_price' as number for CREATE operation ${operationId}. Found: '${operation.limit_price}'. Skipping.`);
            return false;
        }

    }

    return true;
}

async function main() {
    // Determine project root relative to the compiled script location (__dirname)
    const projectRoot = path.resolve(__dirname, '../../..'); 
    const ioDirectory = path.join(projectRoot, 'io');
    const inputFilePath = path.join(ioDirectory, 'orders.json');
    const outputDirectory = path.join(ioDirectory, 'output');
    const tradesOutputPath = path.join(outputDirectory, 'trades.json');
    const orderbookOutputPath = path.join(outputDirectory, 'orderbook.json');

    try {
        await fs.mkdir(outputDirectory, { recursive: true });
        console.log(`Ensured io/output directory exists at ${outputDirectory}`);
    } catch (error) {
        console.error(`Failed to create output directory at ${outputDirectory}:`, error);
        process.exit(1);
    }

    console.log(`Reading operations from: ${inputFilePath}`);
    console.log(`Writing trades to: ${tradesOutputPath}`);
    console.log(`Writing order book to: ${orderbookOutputPath}`);

    let operations: IncomingOperation[];
    try {
        const fileContent = await fs.readFile(inputFilePath, { encoding: 'utf-8' });
        const parsedData = JSON.parse(fileContent); // Parse first

        // Validate that the parsed data is an array
        if (!Array.isArray(parsedData)) {
            throw new Error('Input file content must be a JSON array of operations.');
        }
        operations = parsedData;
        console.log(`Successfully parsed ${operations.length} operations.`);
    } catch (error: any) {
        if (error instanceof SyntaxError) {
            console.error(`Error parsing JSON in ${inputFilePath}:`, error.message);
        } else if (error.code === 'ENOENT') {
            console.error(`Error: Input file not found at ${inputFilePath}`);
        } else {
            console.error(`Error reading input file ${inputFilePath}:`, error.message || error);
        }
        process.exit(1);
    }

    const engine = new MatchingEngine();
    const allTrades: Trade[] = [];

    console.log('Processing operations...');
    let operationIndex = 0;
    for (const operation of operations) {
         // Validate the operation before processing
        if (!validateOperation(operation, operationIndex)) {
            operationIndex++;
            continue; // Skip this invalid operation
        }

        try {
            // Now we know operation is a valid IncomingOperation
            const trades = engine.processOperation(operation);
            allTrades.push(...trades);
        } catch (error) {
            console.error(`Error processing operation ${operation.order_id}:`, error);
            // Decide if you want to continue processing other orders or exit
        }
        operationIndex++;
    }
    console.log(`Processing complete. Generated ${allTrades.length} trades.`);

    try {
        const finalOrderBook = engine.getOutputOrderBook();

        // Convert Trades price/quantity to strings for output
        const outputTrades = allTrades.map(trade => ({
            ...trade,
            price: trade.price.toFixed(8),
            quantity: trade.quantity.toFixed(8)
        }));

        console.log('Writing trades output...');
        await fs.writeFile(tradesOutputPath, JSON.stringify(outputTrades, null, 2));
        console.log('Trades successfully written.');

        console.log('Writing order book output...');
        await fs.writeFile(orderbookOutputPath, JSON.stringify(finalOrderBook, null, 2));
        console.log('Order book successfully written.');

    } catch (error) {
        console.error('Error writing output files:', error);
        process.exit(1);
    }

    console.log('CLI finished successfully.');
}

main().catch(error => {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
}); 