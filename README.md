# 📈 PaperTrader

A real-time paper trading bot that connects to the Binance WebSocket API, applies a technical analysis strategy (EMA + RSI), and displays live results on a sleek dashboard — all without risking real money.

![PaperTrader Dashboard Preview](https://img.shields.io/badge/Status-Live-00ff88?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Neon_DB-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

### 🎬 Quick Preview

<p align="center">
  <img src="demo.gif" alt="PaperTrader Demo" width="800" />
</p>

---

## 🧐 What is PaperTrader?

PaperTrader is a **simulated cryptocurrency trading system** that:

- Streams **live BTC/USDT 5-minute candles** from Binance
- Runs a **technical analysis strategy** using EMA-50 and RSI-14 indicators
- Automatically generates **BUY/SELL signals** and places virtual trades
- Evaluates trades on the next candle close (binary-style expiry)
- Tracks **balance, win rate, and trade history** in a PostgreSQL database (Neon DB)
- Pushes live updates to a **React dashboard** via WebSocket

> ⚠️ **No real money is used.** This is purely for learning, backtesting strategies, and practicing algorithmic trading concepts.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BINANCE WebSocket                     │
│              (wss://stream.binance.com)                  │
└────────────────────────┬────────────────────────────────┘
                         │ Live 5m Kline data
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js)                    │
│                                                          │
│  ┌──────────┐   ┌───────────┐   ┌────────────────────┐  │
│  │ Exchange  │──▶│  Candle   │──▶│  Indicator Service │  │
│  │ WebSocket │   │  Service  │   │  (EMA50 + RSI14)   │  │
│  └──────────┘   └───────────┘   └─────────┬──────────┘  │
│                                            │             │
│                                            ▼             │
│                                  ┌─────────────────┐     │
│                                  │    Strategy      │     │
│                                  │    Service       │     │
│                                  │ (Signal Gen)     │     │
│                                  └────────┬────────┘     │
│                                           │              │
│                                           ▼              │
│                                  ┌─────────────────┐     │
│                                  │  Trade Service   │     │
│                                  │ (Create/Eval)    │     │
│                                  └────────┬────────┘     │
│                                           │              │
│               ┌───────────────────────────┤              │
│               ▼                           ▼              │
│     ┌──────────────┐            ┌──────────────┐         │
│     │   Neon DB     │            │  WS Server   │         │
│     │ (PostgreSQL)  │            │  (port 3001) │         │
│     └──────────────┘            └──────┬───────┘         │
│                                        │                 │
└────────────────────────────────────────┼─────────────────┘
                                         │ JSON via WebSocket
                                         ▼
┌─────────────────────────────────────────────────────────┐
│               FRONTEND (React + Vite)                    │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│   │  Stats   │  │  Price   │  │  Market Analysis     │  │
│   │  Cards   │  │  Chart   │  │  (Recharts)          │  │
│   └──────────┘  └──────────┘  └──────────────────────┘  │
│                                                          │
│   ┌──────────────────────────────────────────────────┐   │
│   │  Recent Activity (Trades / Signal Readiness)     │   │
│   └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
PaperTrader/
├── Backend/
│   ├── server.js                 # Entry point — initializes DB, starts WS
│   ├── app.js                    # Core loop — onCandleClose orchestrator
│   ├── package.json
│   ├── .env                      # Environment variables (DATABASE_URL, etc.)
│   │
│   ├── models/
│   │   ├── candle.model.js       # Candle data shape factory
│   │   └── trade.model.js        # Trade data shape factory
│   │
│   ├── services/
│   │   ├── candle.service.js     # Candle buffer (batch-pruned) + DB persistence
│   │   ├── indicator.service.js  # EMA-50 & RSI-14 calculation
│   │   ├── strategy.service.js   # BUY/SELL signal generation logic
│   │   └── trade.service.js      # Trade CRUD, evaluation, stats (SQL)
│   │
│   ├── store/
│   │   └── store.js              # In-memory state (candles buffer)
│   │
│   ├── utils/
│   │   ├── config.js             # Environment variable loader
│   │   ├── db.js                 # Neon DB connection + table init
│   │   └── logger.js             # Structured logging utility
│   │
│   ├── websocket/
│   │   ├── exchange.js           # Binance WebSocket client
│   │   └── server.js             # WS server for frontend (snapshot + live)
│   │
│   └── tests/
│       └── smoke.test.js         # Basic DB + trade creation test
│
├── Frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx              # React entry point
│       ├── index.css             # Global styles (dark theme, glassmorphism)
│       └── App.jsx               # Dashboard component (charts, stats, trades)
│
└── README.md                     # ← You are here
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- A **[Neon](https://neon.tech)** database (free tier works perfectly)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/PaperTrader.git
cd PaperTrader
```

### 2. Setup the Backend

```bash
cd Backend
npm install
```

Create a `.env` file (or edit the existing one):

```env
PORT=3001
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
BINANCE_WS_URL=wss://stream.binance.com:9443/ws/btcusdt@kline_5m
TRADE_AMOUNT=10
STARTING_BALANCE=1000
PAYOUT=0.8
MAX_CANDLES=100
```

> 💡 Get your `DATABASE_URL` from [Neon Console](https://console.neon.tech) → Your Project → Connection Details.

Start the backend:

```bash
npm start
```

You should see:

```
WebSocket server running on ws://localhost:3001
[INFO] Initializing Database...
[INFO] Database initialized successfully
[INFO] Loaded 4 candles from DB into memory
[INFO] Connected to Binance WebSocket
[INFO] PaperTrader Backend started
```

> On restart, all previously collected candles are loaded back from the database into memory so indicators and the chart resume seamlessly.

### 3. Setup the Frontend

#### Local Development
```bash
cd ../Frontend
npm install
npm run dev
```

#### Production Deployment (Vercel)
1. **Framework Preset**: `Vite`
2. **Root Directory**: `Frontend`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Environment Variable**: `VITE_BACKEND_URL=wss://paper-trader-1.onrender.com`

Open **http://localhost:5173** (local) or your Vercel URL (production).

Open **http://localhost:5173** in your browser.

---

## 📊 Trading Strategy

The bot uses a **pullback + momentum** strategy combining two indicators:

### Indicators

| Indicator | Period | Purpose                          |
|-----------|--------|----------------------------------|
| **EMA**   | 50     | Trend direction                  |
| **RSI**   | 14     | Momentum / overbought-oversold   |

### Entry Conditions

#### 🟢 BUY Signal
All of the following must be true:
1. Current close **above** EMA-50
2. Previous close was **at or below** EMA-50 (pullback crossover)
3. RSI is **above 50** (bullish momentum)
4. Current candle is **green** (close > open)

#### 🔴 SELL Signal
All of the following must be true:
1. Current close **below** EMA-50
2. Previous close was **at or above** EMA-50 (pullback crossover)
3. RSI is **below 50** (bearish momentum)
4. Current candle is **red** (close < open)

### Trade Evaluation
- Trades expire on the **next candle close** (binary-style)
- **WIN**: Price moved in the predicted direction
- **LOSS**: Price moved against or stayed flat
- Payout: **80%** of stake on win, **100%** stake loss on loss

> ℹ️ The strategy requires **50 candles** (~4 hours at 5m intervals) before it can generate any signals, since EMA-50 needs 50 data points.

---

## 🖥️ Dashboard Features

| Feature                | Description                                           |
|------------------------|-------------------------------------------------------|
| **Balance**            | Current virtual account balance                       |
| **Live Price**         | Real-time BTC/USDT price from Binance                |
| **Win Rate**           | Percentage of winning trades                          |
| **Total Trades**       | Count of all executed trades                          |
| **Market Chart**       | Real-time area chart with time-axis and detailed tooltips |
| **Signal Readiness**   | Progress bar showing candles collected vs 50 needed   |
| **Recent Activity**    | Live trade history with entry/exit prices & results   |
| **Candle Closes**      | Recent candle close timestamps while waiting          |
| **Auto-Reconnect**     | Frontend reconnects automatically if WS drops         |
| **Data Persistence**   | All data loads from DB on refresh — nothing is lost   |

---

## 🗄️ Database Schema

Three tables are auto-created on first startup:

### `trades`
| Column       | Type               | Description                     |
|--------------|--------------------|---------------------------------|
| id           | BIGINT (PK)        | Timestamp-based unique ID       |
| type         | TEXT               | `"BUY"` or `"SELL"`             |
| entry        | DOUBLE PRECISION   | Entry price                     |
| exit         | DOUBLE PRECISION   | Exit price (null if open)       |
| entry_index  | INTEGER            | Candle index at entry           |
| expiry_index | INTEGER            | Candle index for expiry         |
| amount       | DOUBLE PRECISION   | Stake amount                    |
| result       | TEXT               | `"WIN"`, `"LOSS"`, or null      |
| created_at   | TIMESTAMP          | Trade creation time             |
| closed_at    | TIMESTAMP          | Trade close time                |

### `candles`
| Column     | Type               | Description                     |
|------------|--------------------|---------------------------------|
| time       | BIGINT (PK)        | Candle open timestamp           |
| open       | DOUBLE PRECISION   | Open price                      |
| high       | DOUBLE PRECISION   | High price                      |
| low        | DOUBLE PRECISION   | Low price                       |
| close      | DOUBLE PRECISION   | Close price                     |
| created_at | TIMESTAMP          | Record creation time            |

### `app_state`
| Column | Type               | Description                     |
|--------|--------------------|---------------------------------|
| key    | TEXT (PK)          | Setting name (e.g. `"balance"`) |
| value  | DOUBLE PRECISION   | Setting value                   |

---

## ⚙️ Configuration

All configuration is done via environment variables in `Backend/.env`:

| Variable          | Default                                           | Description              |
|-------------------|---------------------------------------------------|--------------------------|
| `PORT`            | `3001`                                            | WebSocket server port    |
| `DATABASE_URL`    | —                                                 | Neon PostgreSQL URL      |
| `BINANCE_WS_URL`  | `wss://stream.binance.com:9443/ws/btcusdt@kline_5m` | Binance stream endpoint |
| `TRADE_AMOUNT`    | `10`                                              | Virtual stake per trade  |
| `STARTING_BALANCE`| `1000`                                            | Initial virtual balance  |
| `PAYOUT`          | `0.8`                                             | Win payout multiplier    |
| `MAX_CANDLES`     | `100`                                             | Max candles in RAM (batch-pruned) |

### Changing the Trading Pair or Interval

Update `BINANCE_WS_URL` in `.env`. Examples:

```env
# ETH/USDT 1-minute candles
BINANCE_WS_URL=wss://stream.binance.com:9443/ws/ethusdt@kline_1m

# BTC/USDT 1-minute candles (faster for testing)
BINANCE_WS_URL=wss://stream.binance.com:9443/ws/btcusdt@kline_1m

# BTC/USDT 15-minute candles
BINANCE_WS_URL=wss://stream.binance.com:9443/ws/btcusdt@kline_15m
```

### Memory Management

The in-memory candle buffer is capped at `MAX_CANDLES` (default: 100). When the limit is reached, the **20 oldest candles are removed in one batch** (`splice(0, 20)`), dropping it to 80. This avoids per-candle array shifts and keeps memory stable.

- **In memory**: Sliding window of up to 100 candles (used for indicators + chart)
- **In database**: Full candle history is kept forever (nothing deleted)
- **On restart**: Candles are rehydrated from the DB into memory automatically

---

## 🛠️ Tech Stack

| Layer      | Technology                      | Purpose                       |
|------------|---------------------------------|-------------------------------|
| Backend    | Node.js                         | Server runtime                |
| Database   | Neon DB (PostgreSQL)            | Persistent storage (no ORM)   |
| Market     | Binance WebSocket API           | Live market data stream       |
| Indicators | `technicalindicators` (npm)     | EMA / RSI calculation         |
| Transport  | `ws` (WebSocket)                | Real-time client-server comms |
| Frontend   | React 18 + Vite                 | Dashboard UI                  |
| Charts     | Recharts                        | Price visualization           |
| Icons      | Lucide React                    | UI icons                      |

---

## 🧪 Testing

Run the smoke test (requires a valid `DATABASE_URL`):

```bash
cd Backend
node tests/smoke.test.js
```

This verifies:
- Database connection and table creation
- Candle persistence
- Trade creation and stats calculation

---

## 🛑 Troubleshooting

### 451 Error (Unexpected server response)
If you see `WebSocket error Error: Unexpected server response: 451` in your Render logs:
**Reason**: Binance blocks US-based data center IPs (Render's default region).
**Fix**: 
1. Go to Render Dashboard → **Settings** → **Region**.
2. Change it to **Frankfurt (Germany)** or **Singapore**.
3. Save and redeploy.

Alternatively, change the `BINANCE_WS_URL` environment variable to use the US-based stream:
- `wss://stream.binance.us:9443/ws/btcusdt@kline_5m`

---

## 📝 License

This project is licensed under the ISC License.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## ⚠️ Disclaimer

This project is for **educational purposes only**. It does not involve real money, real trades, or real brokerage accounts. The strategy implemented is a simple demonstration and is **not financial advice**. Do not use this logic for real trading without thorough backtesting and risk management.
