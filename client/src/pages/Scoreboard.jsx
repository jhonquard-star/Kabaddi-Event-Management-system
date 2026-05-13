import { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, Activity, Radio } from 'lucide-react';
import { API_URL } from "../utils/apiBase";

const Scoreboard = () => {
  const [match, setMatch] = useState(null);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/matches/live`);
        setMatch(res.data);
      } catch {
        setMatch(null);
      }
    };
    fetchMatch();
    const interval = setInterval(fetchMatch, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!match) return <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', fontSize: '2rem' }}><Activity className="animate-spin" size={48} style={{ margin: '0 auto 1rem', display: 'block' }} /> Connecting to Stadium Feed...</div>;

  return (
    <div className="animate-fade-in" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div className="badge badge-accent" style={{ fontSize: '1rem', padding: '0.5rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', animation: 'pulse 2s infinite' }}>
          <Radio size={20} /> LIVE BROADCAST
        </div>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(5, 5, 10, 0.95)', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 0 50px rgba(249, 115, 22, 0.1)' }}>
        
        {/* Top Bar - Timer & Details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2rem 4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent)' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.2em' }}>PRO KABADDI SEASON 11</div>
            <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>POOL A - MATCH 12</div>
          </div>
          
          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.8)', padding: '1rem 3rem', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '0.2em', marginBottom: '0.5rem' }}>TIME REMAINING</div>
            <div className="timer-value" style={{ fontSize: '4rem', textShadow: '0 0 30px var(--accent)' }}>
              {Math.floor(match.timer / 60).toString().padStart(2, '0')}:{(match.timer % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.2em' }}>VENUE</div>
            <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>INDOOR STADIUM</div>
          </div>
        </div>

        {/* Main Score Area */}
        <div style={{ flex: 1, display: 'flex', padding: '0 2rem' }}>
          
          {/* Team A */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at center, rgba(249, 115, 22, 0.15), transparent 70%)', zIndex: 0 }}></div>
            <div style={{ zIndex: 1, textAlign: 'center', width: '100%' }}>
              <h2 style={{ fontSize: '3rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '2rem', textShadow: '0 0 20px rgba(249, 115, 22, 0.5)' }}>
                {match.teamAName}
              </h2>
              <div style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '30px', padding: '2rem', border: '2px solid rgba(249, 115, 22, 0.3)', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)' }}>
                <span className="score-value" style={{ fontSize: '14rem', textShadow: '0 0 50px rgba(255,255,255,0.3)' }}>{match.scoreA}</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2rem', zIndex: 2 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1.5rem', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
              <Trophy size={48} color="white" />
            </div>
          </div>

          {/* Team B */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.15), transparent 70%)', zIndex: 0 }}></div>
            <div style={{ zIndex: 1, textAlign: 'center', width: '100%' }}>
              <h2 style={{ fontSize: '3rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '2rem', textShadow: '0 0 20px rgba(59, 130, 246, 0.5)' }}>
                {match.teamBName}
              </h2>
              <div style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '30px', padding: '2rem', border: '2px solid rgba(59, 130, 246, 0.3)', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)' }}>
                <span className="score-value" style={{ fontSize: '14rem', textShadow: '0 0 50px rgba(255,255,255,0.3)' }}>{match.scoreB}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Ticker */}
        <div style={{ background: 'var(--primary)', color: 'white', padding: '1rem', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '0.1em', overflow: 'hidden', whiteSpace: 'nowrap', borderBottomLeftRadius: '18px', borderBottomRightRadius: '18px' }}>
          <div style={{ animation: 'marquee 20s linear infinite', display: 'inline-block' }}>
            LATEST ACTION: {match.events && match.events.length > 0 ? `${match.events[match.events.length-1].team === 'A' ? match.teamAName : match.teamBName} SCORED ${match.events[match.events.length-1].points} POINTS VIA ${match.events[match.events.length-1].type.toUpperCase()}` : 'MATCH IS UNDERWAY - STAY TUNED FOR LIVE ACTION!'}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
};

export default Scoreboard;
