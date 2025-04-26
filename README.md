# xoro

Trading engine written in Typescript. It's structured as a monorepo using pnpm workspaces.

## Design and Implementation Decisions

1. The project is structured as a monorepo to make it easier to manage dependencies and build the project. Would use a microservices architecture in a production setting.
2. Data persistence is in-memory for simplicity.
3. Matching engine is also in TS for simplicity. Would use Go/Rust otherwise.
4. To add a feel for interactivity, I've added a websocket server to the backend.
5. Have added both unit and integration tests.
6. Error handling and logging are basic.


## Project Structure

The monorepo is organized into the following packages:

-   `packages/backend`: Contains the core matching engine logic, order book implementation, and the CLI interface.
-   `packages/frontend`: Contains the user interface for interacting with the trading engine.
-   `packages/common`: Holds shared types, interfaces, and potentially utility functions used by both the backend and frontend.

## Getting Started

1.  **Prerequisites:** Install node.js and pnpm.
2.  **Install Dependencies:** Clone the repository and run the following command in the root directory:
    ```bash
    pnpm install
    ```
    This will install dependencies for all packages.

## Available Scripts

The following scripts are available in the root `package.json` and can be run using `pnpm <script-name>`:

-   `build`: Builds all packages (`backend`, `frontend`, `common`).
-   `build:backend`: Builds only the `backend` package.
-   `build:frontend`: Builds only the `frontend` package.
-   `start:backend:cli`: Runs the backend command-line interface. Assumes input files are in `io/` and outputs to `io/output/`. Requires the backend to be built first (`pnpm build:backend`).
-   `start:backend:server`: Starts the backend API server (requires build first).
-   `start:frontend`: Starts the frontend development server.
-   `start:dev`: Starts both the backend API server and the frontend development server concurrently.
-   `test`: Runs tests in all packages.
-   `test:backend`: Runs tests specifically for the `backend` package.
-   `test:frontend`: Runs tests specifically for the `frontend` package.
-   `clean`: Removes build artifacts (e.g., `dist` folders) from all packages and the root `node_modules` directory. Assumes each package has a corresponding `clean` script.

## Implementation Details

### Backend

*   **Core Logic:** The `MatchingEngine` and `OrderBook` implementations in `packages/backend` are complete and have comprehensive tests (`pnpm test:backend`).
*   **CLI:** The command-line interface (`packages/backend/src/cli.ts`) for processing `io/orders.json` is implemented and can be run via `pnpm start:backend:cli` after building (`pnpm build:backend`).
*   **API Server:** An Express server (`packages/backend/src/server.ts`) provides HTTP endpoints (`/api/orderbook`, `/api/trades`, `/api/submit-order`) and a WebSocket server for real-time updates. It loads initial data from the CLI output.

### Frontend

*   **Framework:** Built with Next.js using the App Router.
*   **Functionality:** Provides a user interface to view the order book, recent trades, and submit new orders.
*   **Connectivity:** Connects to the backend API server via HTTP for initial data and uses WebSockets for real-time updates.

## Running the Application

There are two main ways to run the application:

### 1. Backend CLI Only

This method runs the matching engine based on a static input file (`io/orders.json`) and outputs the results (`io/output/trades.json`, `io/output/orderbook.json`). No web interface is involved.

1.  Build the backend:
    ```bash
    pnpm build:backend
    ```
2.  Ensure your input `orders.json` file is in the `io/` directory at the project root.
3.  Run the CLI:
    ```bash
    pnpm start:backend:cli
    ```
4.  Check the `io/output/` directory for the results.

### 2. Full Web Application (Backend Server + Frontend UI)

This method runs the backend as an API server and the frontend as a web interface that interacts with it.

**Prerequisites:** Build both backend and frontend first.

```bash
pnpm build
```

**Option A: Run Both Concurrently (Recommended)**

Use the `start:dev` script to launch both the backend server and the frontend development server.

```bash
pnpm start:dev
```

This will start:
*   Backend API server (typically on `http://localhost:3001`)
*   Frontend development server (typically on `http://localhost:3000`)

Open `http://localhost:3000` in your browser.

**Option B: Run Separately**

You can also run the backend and frontend in separate terminals:

*   **Terminal 1 (Backend Server):**
    ```bash
    pnpm start:backend:server
    ```
*   **Terminal 2 (Frontend Dev Server):**
    ```bash
    pnpm start:frontend
    ```

Then open `http://localhost:3000` in your browser.
