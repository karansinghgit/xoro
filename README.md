# xoro

Trading engine written in Typescript. It's structured as a monorepo using pnpm workspaces.

## Project Structure

The monorepo is organized into the following packages:

-   `packages/backend`: Contains the core matching engine logic, order book implementation, and the CLI interface.
-   `packages/frontend`: Contains the user interface for interacting with the trading engine (TBD).
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

-   `lint`: Lints the codebase using ESLint across all packages.
-   `format`: Formats the codebase using Prettier across all packages.
-   `typecheck`: Runs TypeScript type checking across all packages.
-   `build`: Builds all packages (`backend`, `frontend`, `common`).
-   `build:backend`: Builds only the `backend` package.
-   `build:frontend`: Builds only the `frontend` package.
-   `start:backend:cli`: Runs the backend command-line interface. Assumes input files are in `io/` and outputs to `io/output/`. Requires the backend to be built first (`pnpm build:backend`).
-   `start:frontend`: Starts the frontend development server (assuming it has a `dev` script). Requires the frontend to be built first (`pnpm build:frontend`).
-   `test`: Runs tests in all packages.
-   `test:backend`: Runs tests specifically for the `backend` package.
-   `test:frontend`: Runs tests specifically for the `frontend` package.
-   `clean`: Removes build artifacts (e.g., `dist` folders) from all packages and the root `node_modules` directory. Assumes each package has a corresponding `clean` script.

## Running the Backend CLI

1.  Build the backend:
    ```bash
    pnpm build:backend
    ```
2.  Prepare your input `orders.json` file in the `io/` directory at the project root.
3.  Run the CLI:
    ```bash
    pnpm start:backend:cli
    ```
4.  Check the `io/output/` directory for `trades.json` and `orderbook.json`.
