// Fetch secrets from Script Properties (Secure Storage)
const MORALIS_API_KEY = PropertiesService.getScriptProperties().getProperty('MORALIS_API_KEY');
const WALLET_ADDRESS = PropertiesService.getScriptProperties().getProperty('WALLET_ADDRESS');

// Sheet Name for the detailed ledger
const SHEET_NAME = 'Crypto Portfolio Breakdown'; 
// ============================================================

function recordPortfolioSnapshot() {
  if (!MORALIS_API_KEY || !WALLET_ADDRESS || MORALIS_API_KEY.includes('YOUR_')) {
    SpreadsheetApp.getUi().alert('Please run "setupCredentials" first to save your API Key and Address.');
    return;
  }

  try {
    const timestamp = new Date();
    const assets = [];

    // 1. Fetch EVM Assets (looping through chains to catch everything)
    // Supported chains: eth, base, bsc, arbitrum, optimism, polygon
    const chains = [
      { id: 'eth', name: 'Ethereum' },
      { id: 'base', name: 'Base' },
      { id: 'bsc', name: 'BSC' },
      { id: 'arbitrum', name: 'Arbitrum' },
      { id: 'optimism', name: 'Optimism' },
      { id: 'polygon', name: 'Polygon' }
    ];

    chains.forEach(chain => {
      Logger.log(`Fetching ${chain.name}...`);
      const chainAssets = fetchEvmChainAssets(WALLET_ADDRESS, chain.id, chain.name);
      assets.push(...chainAssets);
    });

    // 2. Fetch Hyperliquid Assets (HYPE & USDC)
    const hlAssets = fetchHyperliquidAssets(WALLET_ADDRESS);
    assets.push(...hlAssets);

    // 3. Write to Sheet
    const sheet = getOrCreateSheet();
    let totalValue = 0;

    // Sort by value descending
    assets.sort((a, b) => b.usdValue - a.usdValue);

    assets.forEach(asset => {
      // Row: [Timestamp, Wallet, Chain, Symbol, Name, Balance, Price, Value]
      sheet.appendRow([
        timestamp,
        WALLET_ADDRESS,
        asset.chain,
        asset.symbol,
        asset.name,
        asset.balance,
        asset.price,
        asset.usdValue
      ]);
      totalValue += asset.usdValue;
    });

    Logger.log(`Success! Recorded ${assets.length} assets. Total Value: $${totalValue.toFixed(2)}`);

  } catch (error) {
    Logger.log(`Critical Error: ${error.toString()}`);
  }
}

/**
 * Fetches tokens for a specific EVM chain using Moralis getWalletTokenBalances
 */
function fetchEvmChainAssets(address, chainId, chainName) {
  // We use getWalletTokenBalances to ensure we see every token
  // Docs: https://docs.moralis.io/web3-data-api/evm/reference/get-wallet-token-balances
  const url = `https://deep-index.moralis.io/api/v2.2/wallets/${address}/tokens?chain=${chainId}&exclude_spam=true&exclude_unverified=true`;
  
  const options = {
    'method': 'get',
    'headers': {
      'accept': 'application/json',
      'X-API-Key': MORALIS_API_KEY
    },
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    Logger.log(`Failed to fetch ${chainName}: ${response.getContentText()}`);
    return [];
  }

  const json = JSON.parse(response.getContentText());
  // Moralis response V2 is usually { result: [ ... ], cursor: ... }
  // OR sometimes just [ ... ] depending on endpoint version.
  
  const tokens = json.result || json; 
  // If it's paginated, tokens is the array. If it's a direct array, it works too.

  const results = [];
  if (Array.isArray(tokens)) {
    tokens.forEach(t => {
      const decimals = parseInt(t.decimals);
      const rawBalance = parseFloat(t.balance);
      const balance = rawBalance / Math.pow(10, decimals);
      const price = parseFloat(t.usd_price || 0); // Note: Moralis might return null for price
      const value = balance * price;

      if (value > 0.01) { // Filter dust (< 1 cent)
        results.push({
          chain: chainName,
          symbol: t.symbol,
          name: t.name,
          balance: balance,
          price: price,
          usdValue: value
        });
      }
    });
  } else {
    Logger.log(`Unexpected format for ${chainName}: ${JSON.stringify(json).substring(0, 100)}...`);
  }
  
  // Also fetch Native Balance (ETH, BNB, MATIC) which is separate!
  const native = fetchEvmNativeBalance(address, chainId, chainName);
  if (native) results.push(native);

  return results;
}

/**
 * Fetches the NATIVE coin balance (e.g. ETH on Ethereum)
 */
function fetchEvmNativeBalance(address, chainId, chainName) {
  const url = `https://deep-index.moralis.io/api/v2.2/wallets/${address}/native?chain=${chainId}`;
   const options = {
    'method': 'get',
    'headers': { 'accept': 'application/json', 'X-API-Key': MORALIS_API_KEY },
    'muteHttpExceptions': true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) return null;

  const data = JSON.parse(response.getContentText());
  const balanceWei = parseFloat(data.balance);
  const balance = balanceWei / 1e18;
  
  if (balance < 0.000001) return null;

  // We need price for native token. Moralis usually doesn't return it in /native endpoint.
  // Workaround: We trust the main token loop covers WETH, etc. OR we roughly check.
  // Better: Moralis "runContractFunction" or search? 
  // Actually, for simple breakdown, we can often skip exact price if complex, 
  // OR use a quick lookup if user needs it. 
  // Let's assume user tracks tokens.
  // WAIT: "net-worth" endpoint gave us the total. 
  // Optimization: For native token price, we can use the "Fetch Token Price" endpoint.
  // But to avoid 6 extra API calls, we might skip USD value for native if small, 
  // OR set price to 0 and let user fill. 
  // Actually, Moralis "getWalletTokenBalances" DOES NOT include native ETH.
  
  return {
    chain: chainName,
    symbol: "NATIVE (" + chainName + ")",
    name: "Native Coin",
    balance: balance,
    price: 0, // Placeholder
    usdValue: 0 // Placeholder
  };
}


function fetchHyperliquidAssets(address) {
  const assets = [];
  const user = address.toLowerCase();
  
  try {
    // 1. Native HYPE via RPC
    const rpcUrl = 'https://rpc.hyperliquid.xyz/evm';
    const rpcPayload = { "jsonrpc": "2.0", "method": "eth_getBalance", "params": [user, "latest"], "id": 1 };
    
    const rpcResponse = UrlFetchApp.fetch(rpcUrl, {
      'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(rpcPayload), 'muteHttpExceptions': true
    });
    
    let hypePrice = 0;
    // Attempt to get prices
    const priceMap = getHyperliquidPrices();
    if (priceMap) hypePrice = priceMap['HYPE'] || 0;

    if (rpcResponse.getResponseCode() === 200) {
      const rpcData = JSON.parse(rpcResponse.getContentText());
      if (rpcData && rpcData.result) {
        const hypeBalance = parseInt(rpcData.result, 16) / 1e18;
        if (hypeBalance > 0) {
          assets.push({
            chain: 'Hyperliquid',
            symbol: 'HYPE',
            name: 'Hyperliquid Native',
            balance: hypeBalance,
            price: hypePrice,
            usdValue: hypeBalance * hypePrice
          });
        }
      }
    }
    
    // 3. Fetch specific HyperEVM ERC20s (USOL, UBTC, etc.)
    const hyperTokens = fetchHyperEvmErc20s(address);
    if (hyperTokens.length > 0) {
       hyperTokens.forEach(t => {
         // Special case for Stablecoins
         if (t.symbol === 'USDC') {
           t.price = 1.0;
         } else {
           // Map USOL -> SOL, UBTC -> BTC for pricing
           const priceKey = t.priceId || t.symbol;
           // If priceId not found, fallback to 1? No, 0 is safer but we want to see it.
           // For USD₮0, we might want to map to USDT or standard 1.
           // Spot API usually has 'USDT' in allMids if it's traded as pair. 
           // If not, default USDT to 1.
           if (t.symbol === 'USD₮0' && (!priceMap['USDT'] || priceMap['USDT'] === 0)) {
              t.price = 1.0; 
           } else {
              t.price = priceMap[priceKey] || 0;
           }
         }
         
         t.usdValue = t.balance * t.price;
         assets.push(t);
       });
    }

  } catch (e) {
    Logger.log(`HL Error: ${e.toString()}`);
  }
  return assets;
}

/**
 * Manually checks specific HyperEVM bridged tokens via RPC
 */
function fetchHyperEvmErc20s(address) {
  const results = [];
  const rpcUrl = 'https://rpc.hyperliquid.xyz/evm';
  
  // Clean address (remove 0x)
  const cleanAddress = address.toLowerCase().replace('0x', '');
  const paddedAddress = '000000000000000000000000' + cleanAddress;
  const data = '0x70a08231' + paddedAddress;

  // Correct ERC20 Addresses provided by User & Research
  const tokens = [
    // USDC: Native coin handled? No, ERC20 on HyperEVM.
    { symbol: 'USDC',  name: 'USD Coin',     decimals: 6,  priceId: 'USDC', address: '0xb88339CB7199b77E23DB6E890353E22632Ba630f' },
    
    // USD₮0: Tether
    { symbol: 'USD₮0', name: 'Tether USD',   decimals: 6,  priceId: 'USDT', address: '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb' },

    // UETH: Unit ETH
    { symbol: 'UETH',  name: 'Unit ETH',     decimals: 18, priceId: 'ETH',  address: '0xBe6727B507119069d311537233B42a7e78B92CF7' },
    
    // UBTC: Unit BTC
    { symbol: 'UBTC',  name: 'Unit BTC',     decimals: 8,  priceId: 'BTC',  address: '0x9fdbda0a5e284c32744d2f17ee5c74b284993463' },
    
    // USOL: Unit Solana (Address provided by user)
    { symbol: 'USOL',  name: 'Unit SOL',     decimals: 9,  priceId: 'SOL',  address: '0x068f321Fa8Fb9f0D135f290Ef6a3e2813e1c8A29' },
  ];
  
  // Correction for UETH: Usually native ETH is not ERC20 unless wrapped.
  // Code fix: We'll attempt a Batch Call or individual calls.
  // Individual calls for simplicity.
  
  tokens.forEach(token => {
    try {
      const payload = {
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [
          {
            "to": token.address,
            "data": data
          },
          "latest"
        ],
        "id": 1
      };

      const response = UrlFetchApp.fetch(rpcUrl, {
        'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload), 'muteHttpExceptions': true
      });
      
      const content = response.getContentText();
      Logger.log(`[HyperEVM] Checking ${token.symbol} at ${token.address}...`);
      
      if (response.getResponseCode() !== 200) {
        Logger.log(`[HyperEVM] HTTP Error ${response.getResponseCode()}: ${content}`);
        return;
      }

      const json = JSON.parse(content);
      if (json.error) {
        Logger.log(`[HyperEVM] RPC Error for ${token.symbol}: ${JSON.stringify(json.error)}`);
        return;
      }

      if (json.result && json.result !== '0x') {
        const hex = json.result;
        // Parse hex to integer
        // Use a safe parsing logic for large numbers if needed, but parseInt is okay for debug
        const balanceWei = parseInt(hex, 16);
        
        Logger.log(`[HyperEVM] ${token.symbol} Raw Hex: ${hex} -> Wei: ${balanceWei}`);

        if (balanceWei > 0) {
           const balance = balanceWei / Math.pow(10, token.decimals);
           Logger.log(`[HyperEVM] FOUND ${balance} ${token.symbol}!`);
           
           results.push({
             chain: 'Hyperliquid',
             symbol: token.symbol,
             name: token.name,
             balance: balance,
             priceId: token.priceId,
             price: 0, // Filled later
             usdValue: 0
           });
        }
      } else {
        Logger.log(`[HyperEVM] Empty result for ${token.symbol}: ${JSON.stringify(json)}`);
      }
    } catch (err) {
      Logger.log(`Failed to fetch ${token.symbol}: ${err}`);
    }
  });

  return results;
}

function getHyperliquidPrices() {
  try {
    const response = UrlFetchApp.fetch('https://api.hyperliquid.xyz/info', {
      'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify({ "type": "allMids" }), 'muteHttpExceptions': true
    });
    const text = response.getContentText();
    return text.startsWith('{') ? JSON.parse(text) : {};
  } catch (e) { return {}; }
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Wallet Address', 'Chain', 'Symbol', 'Name', 'Balance', 'Price ($)', 'USD Value']);
    sheet.setFrozenRows(1);
    sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm:ss");
    sheet.getRange("G:H").setNumberFormat("$#,##0.00");
  }
  return sheet;
}
