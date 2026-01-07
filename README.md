# SheetFi 📊
> The free, private, and automated crypto portfolio tracker for Google Sheets.

**SheetFi** turns your Google Sheet into a powerful crypto dashboard. It runs entirely on your own Google account using Apps Script, fetching balances from standard EVM chains (via Moralis) and the **Hyperliquid** ecosystem (L1 & HyperEVM).

## Features
*   **🌍 Multi-Chain**: Tracks Ethereum, Base, BSC, Arbitrum, Optimism, and Polygon.
*   **👛 Multi-Wallet**: Supports tracking multiple wallet addresses in a single report.
*   **🚫 Spam Filtering**: Easily filter out unwanted tokens by symbol using Script Properties.
*   **💧 Hyperliquid Native**: Specialized support for Hyperliquid. Tracks Spot, Perps/Margin, and native HyperEVM tokens (HYPE, USOL, UBTC, etc.).
*   **🔒 Private & Secure**: No external databases. You own the code and the keys. Your API keys are stored securely in Google Script Properties, not in the code.
*   **💸 Free to Run**: Uses the free tiers of Moralis and public RPCs.

## Quick Start

1.  Open a new Google Sheet.
2.  Go to **Extensions** > **Apps Script**.
3.  Copy the code from `Code.gs`.
4.  Follow the **[Setup Guide](INSTRUCTIONS.md)** to configure your API Keys, Addresses, and Filters.

## How It Works
SheetFi runs a scheduled script that:
1.  Queries the **Moralis API** for all your EVM assets.
2.  Queries **Hyperliquid** nodes (API + RPC) for your HYPE and L2 assets.
3.  Unifies the data and appends a detailed itemized breakdown to a `PortfolioBreakdown` sheet.

## License
MIT
