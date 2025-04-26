import { promises as fs } from 'fs';
import path from 'path';
import { MatchingEngine } from './matchingEngine';
import { IncomingOperation, Trade, OrderBookOutput } from '@xoro/common';
import { Decimal } from 'decimal.js';

async function main() {
    // Determine project root relative to the compiled script location (__dirname)
    const projectRoot = path.resolve(__dirname, '../../..'); 
    const ioDirectory = path.join(projectRoot, 'io'); // Base io directory on project root
    const inputFilePath = path.join(ioDirectory, 'orders.json');
    const outputDirectory = path.join(ioDirectory, 'output');
    const tradesOutputPath = path.join(outputDirectory, 'trades.json');
    const orderbookOutputPath = path.join(outputDirectory, 'orderbook.json');

    // Ensure the io and output directories exist, create them if not
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
        operations = JSON.parse(fileContent);
        if (!Array.isArray(operations)) {
            throw new Error('Input file content must be a JSON array of operations.');
        }
        console.log(`Successfully parsed ${operations.length} operations.`);
    } catch (error) {
        console.error(`Error reading or parsing input file ${inputFilePath}:`, error);
        process.exit(1);
    }

    const engine = new MatchingEngine();
    const allTrades: Trade[] = [];

    console.log('Processing operations...');
    for (const operation of operations) {
        try {
            const trades = engine.processOperation(operation);
            allTrades.push(...trades);
        } catch (error) {
            console.error(`Error processing operation ${operation.order_id || 'unknown'}:`, error);
        }
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