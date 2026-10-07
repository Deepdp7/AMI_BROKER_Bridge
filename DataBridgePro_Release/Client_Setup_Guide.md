# DataBridge Pro - Full Setup Guide

**Welcome to DataBridge Pro!** 
This guide will help you install and configure everything correctly. 

## 1. Files in this ZIP (`DataBridgePro_Latest_v3.zip`)
*   `DataBridgePro.exe` - The main software UI.
*   `local-api.exe` - The background server (handles WebSocket, DB, and feeds).
*   `DataBridgePro.dll` - The AmiBroker Plugin.

## 2. Installation Steps

### Step 1: Install AmiBroker Plugin
1. Copy **`DataBridgePro.dll`**.
2. Go to your AmiBroker installation folder (usually `C:\Program Files\AmiBroker`).
3. Open the **`Plugins`** folder.
4. Paste `DataBridgePro.dll` inside the Plugins folder.

### Step 2: Set up DataBridge Pro Folder
1. Create a folder named **DataBridge Pro** anywhere on your PC (e.g. `C:\DataBridge`).
2. Extract **`DataBridgePro.exe`** and **`local-api.exe`** into this folder.
3. *Note: Always keep these two files together in the same folder.*

## 3. Connecting AmiBroker
1. Open AmiBroker.
2. Go to **File -> Database Settings**.
3. Create a new Database or modify your existing one.
4. Set **Data source** to `DataBridge Pro (v1.0)`.
5. Set **Local time offset** to `0`. (Don't use time shifts, our plugin handles UTC to IST automatically).
6. Set **Base time interval** to `1 Minute`.
7. Click **Intraday Settings**, check **Filter weekends**, and click OK.

## 4. How to Add Symbols (CRITICAL!)
> [!WARNING]  
> **NEVER import CSV files directly inside AmiBroker.** AmiBroker will misinterpret commas and create broken symbol names (like `RELIANCE,NSE,EQ`). 

**The Correct Way:**
1. Open **DataBridgePro.exe**.
2. Click **Add Symbols -> Import CSV**.
3. Select your CSV file (e.g., `Intraday_Symbols_Fixed.csv`).
4. **DataBridge Pro will automatically push the symbols to AmiBroker with the correct names.** You don't need to do anything in AmiBroker!

## 5. Adding Futures (F&O)
We have fixed the bug where Futures data was mixing with Equity data! 
If you want to track a Future, you must add its EXACT token name (e.g., `WIPRO26OCTFUT`) in your CSV. 
*   **Equity:** `WIPRO`
*   **Futures:** `WIPRO26OCTFUT`

DataBridge Pro will now correctly separate their prices and volumes.

## 6. Starting Your Day
1. Open **DataBridgePro.exe**.
2. Click the Play icon (Start Server).
3. If using Fyers, log in if prompted. 
4. The software will automatically download missing historical data (Backfill) and start streaming live ticks to AmiBroker.

---
*Happy Trading!*
