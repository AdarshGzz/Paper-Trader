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
      initialCapital: '1000.00',
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: '0.00'
    },
    candles: [],
    recentTrades: [],
    history: {
      trades: [],
      page: 1,
      totalPages: 1,
      totalCount: 0
    }
  });

  const [connected, setConnected] = useState(false);
  const [wsRef, setWsRef] = useState(null);

  useEffect(() => {
    let ws;
    let reconnectTimer;

    function connectWs() {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const wsUrl = backendUrl 
        ? (backendUrl.startsWith('http') ? backendUrl.replace('http', 'ws') : backendUrl)
        : `ws://${window.location.hostname}:3001`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        console.log('Connected to PaperTrader Backend');
      };

      ws.onmessage = async (event) => {
        try {
          let rawData = event.data;
          if (rawData instanceof Blob) {
            rawData = await rawData.text();
          }
          const message = JSON.parse(rawData);
          
          if (message.type === 'trades_page') {
            setData(prev => ({
              ...prev,
              history: {
                trades: message.trades || [],
                page: message.page || 1,
                totalPages: message.totalPages || 1,
                totalCount: message.totalCount || 0
              }
            }));
            return;
          }

          setData(prev => ({
            ...prev,
            stats: message.stats || prev.stats,
            candles: message.candles && message.candles.length > 0 ? message.candles : prev.candles,
            recentTrades: message.recentTrades || prev.recentTrades,
            history: message.history || prev.history
          }));
        } catch (err) {
          console.error('Error parsing WS message', err);
        }
      };

      setWsRef(ws);

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

  // Request page on page change
  useEffect(() => {
    if (connected && wsRef && wsRef.readyState === WebSocket.OPEN) {
      wsRef.send(JSON.stringify({ type: 'request_trades_page', page: data.history.page, limit: 10 }));
    }
  }, [connected, wsRef, data.history.page]);

  const fetchPage = (newPage) => {
    if (newPage > 0 && newPage <= data.history.totalPages) {
      setData(prev => ({
        ...prev,
        history: { ...prev.history, page: newPage }
      }));
    }
  };

  useEffect(() => {
    console.log('History state updated:', data.history.trades.length, 'trades');
  }, [data.history]);

  const lastPrice = data.candles.at(-1)?.close || 0;

  return (
    <div className="app-container" style={{scale:".75",marginTop:"-100px"}}>
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
          <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
            Capital: ${data.stats.initialCapital}
          </div>
        </div>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp size={20} className="text-muted" />
            <span className="text-muted">Net P/L</span>
          </div>
          <div className={`stat-value ${parseFloat(data.stats.balance) >= parseFloat(data.stats.initialCapital) ? 'text-success' : 'text-danger'}`}>
            {parseFloat(data.stats.balance) >= parseFloat(data.stats.initialCapital) ? '+' : ''}
            {(parseFloat(data.stats.balance) - parseFloat(data.stats.initialCapital)).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
            {(((parseFloat(data.stats.balance) - parseFloat(data.stats.initialCapital)) / parseFloat(data.stats.initialCapital)) * 100).toFixed(2)}% Return
          </div>
        </div>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BarChart3 size={20} className="text-muted" />
            <span className="text-muted">Win Rate</span>
          </div>
          <div className="stat-value text-success">{data.stats.winRate}%</div>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
            {data.stats.wins}W / {data.stats.losses}L
          </div>
        </div>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <History size={20} className="text-muted" />
            <span className="text-muted">Total Trades</span>
          </div>
          <div className="stat-value">{data.stats.totalTrades}</div>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
             Across all time
          </div>
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
          {data.recentTrades.length > 0 && (
            <div className="trade-list">
              {data.recentTrades.slice(0, 5).map(trade => (
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
          {data.recentTrades.length === 0 && (
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

      <div className="glass-card" style={{ marginTop: '1.5rem' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={18} className="text-muted" />
            <h3>Detailed Trade History</h3>
          </div>
          {data.history.trades.length > 0 && (
            <div className="text-muted" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              {new Date(data.history.trades[0].created_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
              {new Date(data.history.trades[0].created_at).toDateString() !== new Date(data.history.trades.at(-1).created_at).toDateString() && 
                ` - ${new Date(data.history.trades.at(-1).created_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}`}
            </div>
          )}
        </div>
        
        <div className="trade-table-container">
          <table className="trade-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Result</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.history.trades.length > 0 ? (
                data.history.trades.map(trade => (
                  <tr key={trade.id}>
                    <td className="text-muted" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {new Date(trade.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td>
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        fontWeight: 600,
                        color: trade.type === 'BUY' ? '#00ff88' : '#ff4d4d'
                      }}>
                        {trade.type === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {trade.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      ${parseFloat(trade.entry).toFixed(2)}
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {trade.exit ? `$${parseFloat(trade.exit).toFixed(2)}` : '-'}
                    </td>
                    <td>
                      <span className={trade.result === 'WIN' ? 'text-success' : trade.result === 'LOSS' ? 'text-danger' : 'text-muted'} style={{ fontWeight: 500 }}>
                        {trade.result || 'OPEN'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      {trade.balance_after !== null && trade.balance_after !== undefined 
                        ? `$${parseFloat(trade.balance_after).toFixed(2)}` 
                        : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    No trades recorded yet. Waiting for signals...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '20px',
          padding: '10px 0',
          borderTop: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div className="text-muted" style={{ fontSize: '0.9rem' }}>
            Showing page {data.history.page} of {data.history.totalPages} ({data.history.totalCount} total trades)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => fetchPage(data.history.page - 1)}
              disabled={data.history.page === 1}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: '1px solid #333',
                backgroundColor: data.history.page === 1 ? 'transparent' : 'rgba(255,255,255,0.05)',
                color: data.history.page === 1 ? '#444' : '#fff',
                cursor: data.history.page === 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Previous
            </button>
            <button 
              onClick={() => fetchPage(data.history.page + 1)}
              disabled={data.history.page === data.history.totalPages}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: '1px solid #333',
                backgroundColor: data.history.page === data.history.totalPages ? 'transparent' : 'rgba(255,255,255,0.05)',
                color: data.history.page === data.history.totalPages ? '#444' : '#fff',
                cursor: data.history.page === data.history.totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
