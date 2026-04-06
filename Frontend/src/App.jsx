import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Activity, 
  Clock, 
  BarChart3,
  History,
  Info,
  X,
  Target,
  ShieldCheck,
  Zap
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
  ResponsiveContainer,
  ReferenceLine,
  Label,
  Cell
} from 'recharts';

const Candlestick = (props) => {
  const { x, y, width, height, payload } = props;
  const { open, high, low, close } = payload;
  const isUp = close >= open;
  const color = isUp ? '#00ff88' : '#ff4d4d';

  // In Recharts range bar, 'y' is the pixel coordinate of the 'top' of the bar
  // and 'height' is the pixel distance to the 'bottom'.
  const bodyHeight = Math.max(Math.abs(height), 1);
  const ratio = Math.abs(height) / Math.max(Math.abs(close - open), 0.0001);
  
  // Calculate relative pixel offsets for wicks
  const wickTopOffset = (high - Math.max(open, close)) * ratio;
  const wickBottomOffset = (Math.min(open, close) - low) * ratio;

  const wickX = x + width / 2;
  const wickTop = y - wickTopOffset;
  const wickBottom = y + bodyHeight + wickBottomOffset;

  return (
    <g>
      {/* Wick */}
      <line
        x1={wickX}
        y1={wickTop}
        x2={wickX}
        y2={wickBottom}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x}
        y={y}
        width={width}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

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

  const [liveCandle, setLiveCandle] = useState(null);
  const [showStrategy, setShowStrategy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [wsRef, setWsRef] = useState(null);
  const candlesRef = useRef(data.candles);

  // Keep ref in sync with state
  useEffect(() => {
    candlesRef.current = data.candles;
  }, [data.candles]);

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
          
          if (message.type === 'tick') {
            
            setLiveCandle(prev => {
              const tick = message.candle;
              const lastCandle = candlesRef.current.at(-1);
              let updated;

              // If it's a trade tick, we need to merge it with existing data
              if (tick.isTrade) {
                // If we already have a live candle, just update it
                if (prev) {
                  updated = {
                    ...prev,
                    close: tick.close,
                    high: Math.max(prev.high, tick.close),
                    low: Math.min(prev.low, tick.close)
                  };
                } else if (lastCandle) {
                  // If no live candle yet, use the last candle's close as open
                  updated = {
                    open: lastCandle.close,
                    high: Math.max(lastCandle.close, tick.close),
                    low: Math.min(lastCandle.close, tick.close),
                    close: tick.close,
                    time: tick.time
                  };
                } else {
                  // Fallback for very first candle
                  updated = {
                    open: tick.close,
                    high: tick.close,
                    low: tick.close,
                    close: tick.close,
                    time: tick.time
                  };
                }
              } else {
                // Kline update (from backend periodically)
                updated = tick;
              }
              
              // Add body field for range bar
              return { ...updated, body: [updated.open, updated.close] };
            });
            return;
          }

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

          setData(prev => {
            const candles = (message.candles || prev.candles).map(c => ({
              ...c,
              body: [c.open, c.close]
            }));
            return {
              ...prev,
              stats: message.stats || prev.stats,
              candles: candles,
              recentTrades: message.recentTrades || prev.recentTrades,
              history: message.history || prev.history
            };
          });
          
          // Clear live candle on snapshot (new candle close)
          setLiveCandle(null);
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

  const lastPrice = liveCandle?.close || data.candles.at(-1)?.close || 0;
  const activeTrade = data.recentTrades.find(t => t.result === null);
  const pnl = activeTrade 
    ? (activeTrade.type === 'BUY' ? (lastPrice - activeTrade.entry) : (activeTrade.entry - lastPrice)) * activeTrade.quantity
    : 0;

  return (
    <>
      <div className="app-container" style={{scale:".85", marginTop: "-50px"}}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="text-gradient">PaperTrader Dashboard</h1>
            <p className="text-muted">Real-time Trading & Analysis</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button className="strategy-btn" onClick={() => setShowStrategy(true)}>
              <Info size={16} />
              Quick Strategy
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: connected ? '#00ff88' : '#ff4d4d' 
              }} />
              <span className="text-muted">{connected ? 'Live' : 'Disconnected'}</span>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="dashboard-grid">
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Wallet size={20} style={{ color: 'var(--accent-blue)' }} />
              <span className="text-muted">Balance</span>
            </div>
            <div className="stat-value text-gradient">${data.stats.balance}</div>
            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Capital: ${data.stats.initialCapital}
            </div>
          </div>
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <TrendingUp size={20} style={{ color: 'var(--accent-success)' }} />
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
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BarChart3 size={20} style={{ color: 'var(--accent-success)' }} />
              <span className="text-muted">Win Rate</span>
            </div>
            <div className="stat-value text-success">{data.stats.winRate}%</div>
            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              {data.stats.wins}W / {data.stats.losses}L
            </div>
          </div>
          <div className="glass-card" style={{ borderLeft: '4px solid #888' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <History size={20} style={{ color: '#888' }} />
              <span className="text-muted">Total Trades</span>
            </div>
            <div className="stat-value">{data.stats.totalTrades}</div>
            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
               Across all time
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="glass-card chart-section" style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={20} className="text-success" />
              Market Analysis (BTC/USDT)
            </h3>
            <div className="text-muted" style={{ fontSize: '0.9rem', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>5m Interval</div>
          </div>
          <div style={{ height: '600px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={[...data.candles, ...(liveCandle ? [liveCandle] : [])]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(t) => new Date(Number(t)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  stroke="#444"
                  tick={{ fontSize: 10, fill: '#666' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="#444"
                  tick={{ fontSize: 11, fill: '#666' }}
                  orientation="right"
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div style={{ padding: '8px', fontSize: '0.8rem' }}>
                          <div style={{ color: '#888', marginBottom: '8px' }}>{new Date(Number(d.time)).toLocaleString()}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <span>Open:</span> <span style={{ textAlign: 'right' }}>${parseFloat(d.open).toFixed(2)}</span>
                            <span>High:</span> <span style={{ textAlign: 'right', color: 'var(--accent-success)' }}>${parseFloat(d.high).toFixed(2)}</span>
                            <span>Low:</span> <span style={{ textAlign: 'right', color: 'var(--accent-danger)' }}>${parseFloat(d.low).toFixed(2)}</span>
                            <span style={{ fontWeight: 700 }}>Close:</span> <span style={{ textAlign: 'right', fontWeight: 700 }}>${parseFloat(d.close).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                
                <Bar 
                  dataKey="body" 
                  shape={<Candlestick />}
                  isAnimationActive={false}
                  barCategoryGap="30%"
                >
                  {data.candles.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.close >= entry.open ? 'var(--accent-success)' : 'var(--accent-danger)'} />
                  ))}
                </Bar>
                
                <Line dataKey="high" stroke="none" dot={false} isAnimationActive={false} />
                <Line dataKey="low" stroke="none" dot={false} isAnimationActive={false} />

                {activeTrade && (
                  <>
                    <ReferenceLine y={activeTrade.entry} stroke="#fff" strokeDasharray="4 4" strokeWidth={1}>
                      <Label value="ENTRY" position="left" fill="#fff" fontSize={9} fontWeight={700} />
                    </ReferenceLine>
                    <ReferenceLine y={activeTrade.sl} stroke="var(--accent-danger)" strokeDasharray="3 3" strokeWidth={1.5}>
                      <Label value="SL" position="right" fill="var(--accent-danger)" fontSize={10} fontWeight={800} />
                    </ReferenceLine>
                    <ReferenceLine y={activeTrade.tp} stroke="var(--accent-success)" strokeDasharray="3 3" strokeWidth={1.5}>
                      <Label value="TP" position="right" fill="var(--accent-success)" fontSize={10} fontWeight={800} />
                    </ReferenceLine>
                    <Line yAxisId={0} dataKey={() => activeTrade.sl} stroke="none" dot={false} isAnimationActive={false} />
                    <Line yAxisId={0} dataKey={() => activeTrade.tp} stroke="none" dot={false} isAnimationActive={false} />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Opened Trades Details Section */}
        <div className="glass-card trades-section" style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={18} className="text-success" />
            <h3>Opened Trades Monitoring</h3>
          </div>

          {activeTrade ? (
            <div className="active-trade-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <span className={`trade-badge ${activeTrade.type === 'BUY' ? 'long' : 'short'}`}>
                    {activeTrade.type} position
                  </span>
                  <div style={{ fontSize: '0.85rem' }}>
                    <span className="text-muted">ID: </span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{activeTrade.id.slice(0,8)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={pnl >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 800, fontSize: '1.8rem', fontFamily: 'JetBrains Mono', lineHeight: 1 }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} <span style={{ fontSize: '0.9rem' }}>USDT</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '6px', letterSpacing: '1px' }}>UNREALIZED P/L</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '6px', textTransform: 'uppercase' }}>Entry Price</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>${parseFloat(activeTrade.entry).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '6px', textTransform: 'uppercase' }}>Target Price</div>
                  <div className="text-success" style={{ fontWeight: 700, fontSize: '1.1rem' }}>${parseFloat(activeTrade.tp).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '6px', textTransform: 'uppercase' }}>Stop Loss</div>
                  <div className="text-danger" style={{ fontWeight: 700, fontSize: '1.1rem' }}>${parseFloat(activeTrade.sl).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '6px', textTransform: 'uppercase' }}>Current Price</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>${lastPrice.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem' }}>
                  <span className="text-muted">Momentum to Target</span>
                  <span className="text-success" style={{ fontWeight: 800 }}>
                    {Math.max(0, Math.min(100, Math.abs(lastPrice - activeTrade.entry) / Math.abs(activeTrade.tp - activeTrade.entry) * 100)).toFixed(0)}%
                  </span>
                </div>
                <div className="progress-bar-bg" style={{ height: '10px' }}>
                  <div className="progress-bar-fill success" style={{ 
                    width: `${Math.max(2, Math.min(100, Math.abs(lastPrice - activeTrade.entry) / Math.abs(activeTrade.tp - activeTrade.entry) * 100))}%` 
                  }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="radar-container" style={{ padding: '40px 0' }}>
              <div className="pulse-dot" />
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '30px', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
                Monitoring Market Sequence
              </p>
              
              {data.candles.length < 50 && (
                <div style={{ maxWidth: '400px', width: '100%', marginTop: '40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.8rem' }}>
                    <span className="text-muted">EMA SYNC IN PROGRESS</span>
                    <span style={{ fontWeight: 800 }}>{data.candles.length}/50 DATA POINTS</span>
                  </div>
                  <div className="progress-bar-bg" style={{ height: '4px' }}>
                    <div className="progress-bar-fill" style={{ width: `${(data.candles.length / 50) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-muted" style={{ fontSize: '0.9rem' }}>
              Showing page {data.history.page} of {data.history.totalPages} ({data.history.totalCount} total trades)
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => fetchPage(data.history.page - 1)} disabled={data.history.page === 1} className="strategy-btn" style={{ padding: '6px 16px' }}>Previous</button>
              <button onClick={() => fetchPage(data.history.page + 1)} disabled={data.history.page === data.history.totalPages} className="strategy-btn" style={{ padding: '6px 16px' }}>Next</button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Strategy Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${showStrategy ? 'open' : ''}`} 
        onClick={() => setShowStrategy(false)}
      />

      {/* Strategy Sidebar Content */}
      <div className={`sidebar-content ${showStrategy ? 'open' : ''}`}>
        <button className="close-btn" onClick={() => setShowStrategy(false)}>
          <X size={20} />
        </button>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 className="text-gradient" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Bot Strategy</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>BTC/USDT Trend-Flow Engine</p>
        </div>

        <div className="strategy-section">
          <h4>
            <Zap size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Trading Logic (5m)
          </h4>
          <ul className="strategy-list">
            <li>Trend detection using EMA (50-period)</li>
            <li>Momentum confirmation via RSI (14-period)</li>
            <li><strong>LONG</strong>: Price &gt; EMA50 + RSI &gt; 50 + Green Candle</li>
            <li><strong>SHORT</strong>: Price &lt; EMA50 + RSI &lt; 50 + Red Candle</li>
            <li>Entry occurs precisely on the 5-minute candle close</li>
          </ul>
        </div>

        <div className="strategy-section">
          <h4>
            <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Risk Management
          </h4>
          <ul className="strategy-list">
            <li><strong>1% Risk</strong>: Position size is calculated to lose exactly 1% of balance per trade</li>
            <li><strong>Structural SL</strong>: Placed at the recent swing low/high</li>
            <li><strong>Profit Target</strong>: 1.5x Risk-to-Reward ratio</li>
            <li><strong>Daily Limits</strong>: Autostop at -3% loss or +5% profit</li>
          </ul>
        </div>

        <div className="strategy-section">
          <h4>
            <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Operating Hours (IST)
          </h4>
          <ul className="strategy-list">
            <li><strong>London/NY Flow</strong>: 12:30 PM – 8:30 PM</li>
            <li><strong>Wick Avoidance</strong>: Strictly paused 4:30 AM – 7:30 AM</li>
            <li>Market observation is 24/7 (Real-time chart)</li>
          </ul>
        </div>

        <div style={{ marginTop: 'auto', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
            Daily PnL resets automatically at 00:00 IST
          </p>
        </div>
      </div>
    </>
  );
}

export default App;
