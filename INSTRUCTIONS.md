# Crypto Portfolio Tracker Setup

This guide will help you set up the Google Apps Script to track your crypto portfolio in Google Sheets.

## Prerequisites
1.  **Google Account**: To use Google Sheets.
2.  **Moralis Account**: to get a free API Key.

## Step 1: Get your API Key
1.  Go to [Moralis.io](https://moralis.io/) and sign up for a **free** account.
2.  Log in to the **Moralis Admin Dashboard**.
3.  Go to **Settings** -> **API Keys**.
4.  Copy your **Web3 API Key**. (It usually starts with `matches...` or similar characters).

## Step 2: Set up the Google Sheet
1.  Open a new or existing **Google Sheet**.
2.  In the menu, go to **Extensions** > **Apps Script**.
3.  A new tab will open with a code editor.
4.  Delete any code currently in the `Code.gs` file.
5.  Copy the **ENTIRE** content of `Code.gs` (provided in this folder) and paste it into the editor.

### 3. Configure the Script (Securely)
1.  **Paste the Code**: Copy the contents of `Code.gs` into the script editor.
2.  **Set Credentials**:
    *   Go to Project settings on Apps Scripts
    *   Add `'MORALIS_API_KEY'` with your actual key.
    *   Add `'WALLET_ADDRESS'` with your wallet address.
3.  **Run Setup**:
    *   Select `setupCredentials` from the dropdown menu in the toolbar.
    *   Click **Run**.
    *   (Grant permissions if asked).
4.  **Clean Up**:
    *   **Delete** the keys you just pasted in `setupCredentials()` inside the code editor. Replace them with empty strings or comments.
    *   This ensures your secrets are **NOT** in the code if you share it on GitHub. They are stored safely in the script's hidden properties.

### 4. Test It
1.  Select `recordPortfolioSnapshot` from the dropdown.
2.  Click **Run**.
3.  **Authorization**: Google will ask for permission to access your Sheet and external services.
    *   Click **Review Permissions**.
    *   Choose your account.
    *   (If you see "Google hasn't verified this app", click **Advanced** -> **Go to (Script Name) (unsafe)**. It is safe because it's *your* script).
    *   Click **Allow**.
4.  Wait for the script to finish.
5.  Go back to your Google Sheet tab. You should see a new tab called **PortfolioHistory** with a new row showing your balance!

## Step 5: Automate it (Triggers)
To make it run automatically (e.g., every hour):
1.  In the Apps Script editor, click on the **Clock icon** (Triggers) in the left sidebar.
2.  Click **+ Add Trigger** (bottom right).
3.  Configure:
    *   Choose which function to run: `recordPortfolioSnapshot`
    *   Select event source: **Time-driven**
    *   Select type of time based trigger: **Day timer** (or Hour timer)
    *   Select time of day: (Choose your preference)
4.  Click **Save**.

**Done!** Your sheet will now update automatically.
