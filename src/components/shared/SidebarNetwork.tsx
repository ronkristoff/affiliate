/**
 * Animated network constellation SVG for auth sidebar backgrounds.
 * Nodes pulse to simulate live network activity; dashed lines flow
 * along connections like data moving through an affiliate network.
 *
 * Pure SVG + CSS animations — no JS, fully GPU-composited.
 */

export function SidebarNetwork() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 480 900"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* ── Connection Lines (data-flow dashes) ── */}
      {/* Primary flow — top cluster */}
      <line x1="80" y1="60" x2="200" y2="140" className="sidebar-network-lines" stroke="rgba(22,89,214,0.18)" strokeWidth="1" />
      <line x1="200" y1="140" x2="340" y2="90" className="sidebar-network-lines-slow" stroke="rgba(22,89,214,0.12)" strokeWidth="1" />
      <line x1="200" y1="140" x2="150" y2="260" className="sidebar-network-lines" stroke="rgba(22,89,214,0.15)" strokeWidth="1" />
      <line x1="340" y1="90" x2="420" y2="200" className="sidebar-network-lines-reverse" stroke="rgba(22,89,214,0.10)" strokeWidth="1" />

      {/* Mid-left cluster */}
      <line x1="150" y1="260" x2="60" y2="370" className="sidebar-network-lines-slow" stroke="rgba(22,89,214,0.15)" strokeWidth="1" />
      <line x1="150" y1="260" x2="280" y2="310" className="sidebar-network-lines" stroke="rgba(22,89,214,0.18)" strokeWidth="1" />
      <line x1="60" y1="370" x2="120" y2="480" className="sidebar-network-lines-reverse" stroke="rgba(22,89,214,0.12)" strokeWidth="1" />

      {/* Right spine */}
      <line x1="420" y1="200" x2="380" y2="340" className="sidebar-network-lines" stroke="rgba(22,89,214,0.14)" strokeWidth="1" />
      <line x1="380" y1="340" x2="440" y2="460" className="sidebar-network-lines-slow" stroke="rgba(22,89,214,0.12)" strokeWidth="1" />
      <line x1="280" y1="310" x2="380" y2="340" className="sidebar-network-lines-reverse" stroke="rgba(22,89,214,0.10)" strokeWidth="1" />

      {/* Bottom cluster */}
      <line x1="120" y1="480" x2="260" y2="530" className="sidebar-network-lines" stroke="rgba(22,89,214,0.15)" strokeWidth="1" />
      <line x1="260" y1="530" x2="440" y2="460" className="sidebar-network-lines-slow" stroke="rgba(22,89,214,0.10)" strokeWidth="1" />
      <line x1="260" y1="530" x2="180" y2="640" className="sidebar-network-lines" stroke="rgba(22,89,214,0.13)" strokeWidth="1" />
      <line x1="440" y1="460" x2="350" y2="570" className="sidebar-network-lines-reverse" stroke="rgba(22,89,214,0.11)" strokeWidth="1" />

      {/* Lower connections */}
      <line x1="180" y1="640" x2="90" y2="740" className="sidebar-network-lines-slow" stroke="rgba(22,89,214,0.12)" strokeWidth="1" />
      <line x1="180" y1="640" x2="350" y2="570" className="sidebar-network-lines" stroke="rgba(22,89,214,0.10)" strokeWidth="1" />
      <line x1="350" y1="570" x2="400" y2="700" className="sidebar-network-lines-reverse" stroke="rgba(22,89,214,0.09)" strokeWidth="1" />
      <line x1="90" y1="740" x2="400" y2="700" className="sidebar-network-lines-slow" stroke="rgba(22,89,214,0.08)" strokeWidth="1" />

      {/* Cross-links for density */}
      <line x1="80" y1="60" x2="60" y2="370" className="sidebar-network-lines-reverse" stroke="rgba(22,89,214,0.06)" strokeWidth="0.5" />
      <line x1="280" y1="310" x2="260" y2="530" className="sidebar-network-lines" stroke="rgba(22,89,214,0.07)" strokeWidth="0.5" />

      {/* ── Nodes (pulsing dots) ── */}
      {/* Top cluster */}
      <circle cx="80" cy="60" r="2.5" fill="rgba(125,211,252,0.7)" className="sidebar-node-pulse" />
      <circle cx="200" cy="140" r="3" fill="rgba(125,211,252,0.8)" />
      <circle cx="340" cy="90" r="2" fill="rgba(125,211,252,0.5)" className="sidebar-node-pulse-delay" />
      <circle cx="420" cy="200" r="2" fill="rgba(125,211,252,0.4)" className="sidebar-node-pulse" />

      {/* Mid cluster */}
      <circle cx="150" cy="260" r="3" fill="rgba(125,211,252,0.7)" className="sidebar-node-pulse-delay" />
      <circle cx="60" cy="370" r="2" fill="rgba(125,211,252,0.5)" className="sidebar-node-pulse" />
      <circle cx="280" cy="310" r="2.5" fill="rgba(125,211,252,0.6)" />
      <circle cx="380" cy="340" r="2" fill="rgba(125,211,252,0.4)" className="sidebar-node-pulse-delay" />

      {/* Bottom cluster */}
      <circle cx="120" cy="480" r="2.5" fill="rgba(125,211,252,0.6)" className="sidebar-node-pulse" />
      <circle cx="260" cy="530" r="3" fill="rgba(125,211,252,0.7)" className="sidebar-node-pulse-delay" />
      <circle cx="440" cy="460" r="2" fill="rgba(125,211,252,0.4)" />
      <circle cx="180" cy="640" r="2" fill="rgba(125,211,252,0.5)" className="sidebar-node-pulse" />

      {/* Lower nodes */}
      <circle cx="350" cy="570" r="2" fill="rgba(125,211,252,0.4)" className="sidebar-node-pulse-delay" />
      <circle cx="90" cy="740" r="2.5" fill="rgba(125,211,252,0.5)" />
      <circle cx="400" cy="700" r="2" fill="rgba(125,211,252,0.3)" className="sidebar-node-pulse" />

      {/* ── Glow rings on key nodes ── */}
      <circle cx="200" cy="140" r="3" fill="none" stroke="rgba(125,211,252,0.3)" strokeWidth="1" className="sidebar-node-glow" />
      <circle cx="260" cy="530" r="3" fill="none" stroke="rgba(125,211,252,0.3)" strokeWidth="1" className="sidebar-node-glow-delay" />
      <circle cx="150" cy="260" r="3" fill="none" stroke="rgba(125,211,252,0.25)" strokeWidth="1" className="sidebar-node-glow" />
    </svg>
  );
}
