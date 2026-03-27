import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Activity, 
  Clock, 
  BarChart3,
  History
} from 'lucide-react';
import { 
  ComposedChart, 
  Line, 
  Area, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

function App() {
  const [data, setData] = useState({
    stats: {
      balance: '1000.00',
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: '0.00'
    },
    candles: [],
    trades: []
  });

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws;
    let reconnectTimer;

    function connectWs() {
      // Use environment variable if provided, else fallback to current host or localhost
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const wsUrl = backendUrl 
        ? (backendUrl.startsWith('http') ? backendUrl.replace('http', 'ws') : backendUrl)
        : `ws://${window.location.hostname}:3001`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        console.log('Connected to PaperTrader Backend');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setData(prev => ({
            ...prev,
            stats: message.stats || prev.stats,
            candles: message.candles && message.candles.length > 0 ? message.candles : prev.candles,
            trades: message.recentTrades || prev.trades
          }));
        } catch (err) {
          console.error('Error parsing WS message', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('Disconnected. Reconnecting in 3s...');
        reconnectTimer = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWs();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const lastPrice = data.candles.at(-1)?.close || 0;

  return (
    <div className="app-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-gradient">PaperTrader Dashboard</h1>
          <p className="text-muted">Real-time Trading & Analysis</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: connected ? '#00ff88' : '#ff4d4d' 
          }} />
          <span className="text-muted">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Wallet size={20} className="text-muted" />
            <span className="text-muted">Balance</span>
          </div>
          <div className="stat-value text-gradient">${data.stats.balance}</div>
        </div>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={20} className="text-muted" />
            <span className="text-muted">Live Price</span>
          </div>
          <div className="stat-value" style={{ color: '#fff' }}>${lastPrice.toFixed(2)}</div>
        </div>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BarChart3 size={20} className="text-muted" />
            <span className="text-muted">Win Rate</span>
          </div>
          <div className="stat-value text-success">{data.stats.winRate}%</div>
        </div>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <History size={20} className="text-muted" />
            <span className="text-muted">Total Trades</span>
          </div>
          <div className="stat-value">{data.stats.totalTrades}</div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateRows: 'auto' }}>
        {/* Chart Section */}
        <div className="glass-card chart-section">
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <h3>Market Analysis (BTC/USDT)</h3>
            <div className="text-muted" style={{ fontSize: '0.9rem' }}>Interval: 5m</div>
          </div>
          <div style={{ height: '400px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.candles}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(t) => new Date(Number(t)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  stroke="#555"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="#555"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                  labelFormatter={(t) => new Date(Number(t)).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  formatter={(value) => [`$${parseFloat(value).toFixed(2)}`, 'Close']}
                />
                <Area 
                  type="monotone" 
                  dataKey="close" 
                  stroke="#00ff88" 
                  fill="url(#colorPrice)" 
                />
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Section */}
        <div className="glass-card trades-section">
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={18} className="text-muted" />
            <h3>Recent Activity</h3>
          </div>

          {/* Trades Section */}
          {data.trades.length > 0 && (
            <div className="trade-list">
              {data.trades.map(trade => (
                <div key={trade.id} className="trade-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {trade.type === 'BUY' ? <TrendingUp size={14} className="text-success" /> : <TrendingDown size={14} className="text-danger" />}
                      <span style={{ fontWeight: 600 }}>{trade.type}</span>
                    </div>
                    <span className={trade.result === 'WIN' ? 'text-success' : trade.result === 'LOSS' ? 'text-danger' : 'text-muted'}>
                      {trade.result || 'OPEN'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.85rem' }} className="text-muted">
                    <span>Entry: ${parseFloat(trade.entry).toFixed(2)}</span>
                    {trade.exit && <span>Exit: ${parseFloat(trade.exit).toFixed(2)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Signal readiness indicator */}
          {data.trades.length === 0 && (
            <div style={{ padding: '10px 0' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Signal Readiness</span>
                  <span style={{ fontSize: '0.85rem', fontFamily: 'JetBrains Mono, monospace' }}>
                    {Math.min(data.candles.length, 50)}/50 candles
                  </span>
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '4px', 
                  backgroundColor: 'rgba(255,255,255,0.05)', 
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${Math.min((data.candles.length / 50) * 100, 100)}%`, 
                    height: '100%', 
                    backgroundColor: data.candles.length >= 50 ? '#00ff88' : '#f59e0b',
                    borderRadius: '2px',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                  Need 50 candles for EMA50 indicator. At 5m intervals, ~{Math.max(0, Math.ceil((50 - data.candles.length) * 5))} min remaining.
                </p>
              </div>

              {/* Show recent candle closes as activity */}
              {data.candles.length > 0 && (
                <>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                    Candle Closes
                  </div>
                  {data.candles.slice(-5).reverse().map((c, i) => (
                    <div key={i} className="trade-item" style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span className="text-muted">
                          {new Date(Number(c.time)).toLocaleTimeString()}
                        </span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          ${parseFloat(c.close).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
