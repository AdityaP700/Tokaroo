import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart2,
  Layers,
  ArrowLeft,
  AlertOctagon,
  Database,
  Eye,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useStore } from "../store/useStore";

const navGroups = [
  {
    title: "Core",
    items: [
      {
        id: "context",
        path: "/app/context",
        label: "Context Debugger",
        icon: Activity,
      },
    ],
  },
  {
    title: "Analysis",
    items: [
      {
        id: "cause-explorer",
        path: "#",
        label: "Cause Explorer",
        icon: AlertOctagon,
        disabled: true,
      },
      {
        id: "retrieval-debugger",
        path: "#",
        label: "Retrieval Debugger",
        icon: Database,
        disabled: true,
      },
      {
        id: "attention-inspector",
        path: "#",
        label: "Attention Inspector",
        icon: Eye,
        disabled: true,
      },
    ],
  },
  {
    title: "Playground",
    items: [
      { id: "rag", path: "/app/rag", label: "RAG Sandbox", icon: Layers },
      {
        id: "model",
        path: "/app/model",
        label: "Model Compare",
        icon: BarChart2,
      },
    ],
  },
  {
    title: "Learn",
    items: [
      {
        id: "failure-patterns",
        path: "#",
        label: "Failure Patterns",
        icon: AlertOctagon,
        disabled: true,
      },
      {
        id: "docs",
        path: "#",
        label: "Docs / Examples",
        icon: FileText,
        disabled: true,
      },
    ],
  },
];

interface SidebarProps {
  currentView: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView }) => {
  const navigate = useNavigate();
  const { simulation } = useStore();
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasData = simulation.chunks.length > 0;
  const open = hovered || expanded;

  return (
    <div
      className={`sidebar-shell ${open ? "expanded" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: "100%",
        width: open ? "220px" : "64px",
        display: "flex",
        flexDirection: "column",
        padding: "1rem 0.65rem",
        background: "rgba(17,17,17,0.96)",
        borderRight: "1px solid var(--border)",
        transition: "width 0.2s ease, box-shadow 0.2s ease",
        overflow: "hidden",
        position: "relative",
        zIndex: 40,
        boxShadow: open ? "12px 0 35px rgba(0,0,0,0.35)" : "none",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: open ? "space-between" : "center",
          gap: "8px",
          marginBottom: "1.15rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "9px",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 0 24px rgba(255,255,255,0.12)",
            }}
          >
            <div
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: "var(--bg)",
              }}
            />
          </div>
          <span
            className="sidebar-logo-word"
            style={{
              fontWeight: 800,
              fontSize: "16px",
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              transition: "opacity 0.15s ease",
            }}
          >
            Tokaroo
          </span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Collapse sidebar" : "Pin sidebar open"}
          style={{
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-secondary)",
            borderRadius: "7px",
            width: "28px",
            height: "28px",
            display: open ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {expanded ? (
            <PanelLeftClose size={14} />
          ) : (
            <PanelLeftOpen size={14} />
          )}
        </button>
      </div>

      {/* Back to home */}
      <button
        onClick={() => navigate("/")}
        className="sidebar-nav-button"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 10px",
          width: "100%",
          minHeight: "36px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          background: "transparent",
          marginBottom: "0.8rem",
          transition: "background 0.15s ease",
        }}
      >
        <ArrowLeft
          size={16}
          style={{ color: "var(--text-muted)", flexShrink: 0 }}
        />
        <span
          className="sidebar-back-label sidebar-label"
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
            transition: "opacity 0.15s ease, transform 0.15s ease",
          }}
        >
          Back to Home
        </span>
      </button>

      <div
        style={{
          height: "1px",
          background: "var(--border)",
          margin: "0 0 0.85rem",
        }}
      />

      {/* Nav */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.2rem",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            <div
              className="sidebar-group-title"
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "6px",
                paddingLeft: "10px",
                whiteSpace: "nowrap",
                transition: "opacity 0.15s ease",
              }}
            >
              {group.title}
            </div>
            <nav
              style={{ display: "flex", flexDirection: "column", gap: "3px" }}
            >
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!item.disabled) navigate(item.path);
                    }}
                    disabled={item.disabled}
                    className="sidebar-nav-button"
                    title={!open ? item.label : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      width: "100%",
                      minHeight: "36px",
                      borderRadius: "var(--radius-sm)",
                      border: isActive
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid transparent",
                      cursor: item.disabled ? "not-allowed" : "pointer",
                      textAlign: "left",
                      transition:
                        "background 0.15s, color 0.15s, border-color 0.15s",
                      background: isActive
                        ? "rgba(255,255,255,0.06)"
                        : "transparent",
                      opacity: item.disabled ? 0.45 : 1,
                      color: isActive
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    }}
                  >
                    <Icon
                      size={16}
                      style={{
                        color: isActive
                          ? "#fff"
                          : item.disabled
                            ? "var(--text-disabled)"
                            : "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="sidebar-label"
                      style={{
                        fontSize: "13px",
                        fontWeight: isActive ? 650 : 500,
                        color: isActive
                          ? "var(--text-primary)"
                          : item.disabled
                            ? "var(--text-disabled)"
                            : "var(--text-secondary)",
                        transition: "opacity 0.15s ease, transform 0.15s ease",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <div
                        className="sidebar-active-dot"
                        style={{
                          marginLeft: "auto",
                          width: "5px",
                          height: "5px",
                          borderRadius: "50%",
                          background: "#fff",
                          flexShrink: 0,
                          transition: "opacity 0.15s ease",
                          boxShadow: "0 0 10px rgba(255,255,255,0.3)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Status */}
      <div
        className="sidebar-status"
        style={{
          padding: "10px 11px",
          borderRadius: "var(--radius-sm)",
          background: "rgba(255,255,255,0.035)",
          border: "1px solid var(--border)",
          transition: "opacity 0.15s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "3px",
          }}
        >
          <div
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: hasData ? "var(--success)" : "var(--text-disabled)",
              boxShadow: hasData ? "0 0 12px rgba(22,163,74,0.35)" : "none",
            }}
          />
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: hasData ? "var(--success)" : "var(--text-muted)",
            }}
          >
            {hasData ? "Active" : "Idle"}
          </span>
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            whiteSpace: "nowrap",
          }}
        >
          {hasData ? `${simulation.chunks.length} chunks` : "No data"}
        </div>
      </div>
    </div>
  );
};
