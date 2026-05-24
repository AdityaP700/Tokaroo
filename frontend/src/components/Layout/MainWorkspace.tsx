import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sidebar } from "../Sidebar";
import { InputConsole } from "../Panels/InputConsole";
import { CoreVisualization } from "../Panels/CoreVisualization";
import { AnalysisEngine } from "../Panels/AnalysisEngine";

import { CompareView } from "../CompareView";
import { RagView } from "../RagView";

const VIEW_LABELS: Record<string, string> = {
  context: "Context Debugger",
  model: "Model Compare",
  rag: "RAG Sandbox",
};

export const MainWorkspace: React.FC = () => {
  const { view } = useParams<{ view: string }>();
  const navigate = useNavigate();
  const currentView = view || "context";

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--bg)",
        fontFamily: "var(--font-sans)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="sidebar-full"
        style={{
          width: "64px",
          flexShrink: 0,
          position: "relative",
          zIndex: 50,
        }}
      >
        <Sidebar currentView={currentView} />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          padding: "0 10px 10px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 6px 6px 6px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            Home
          </button>
          <span style={{ color: "var(--border-hi)", fontSize: "12px" }}>/</span>
          <span
            style={{
              color: "var(--text-primary)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {VIEW_LABELS[currentView] ?? currentView}
          </span>
        </div>

        {currentView === "context" && (
          <div
            className="app-panels"
            style={{ flex: 1, display: "flex", gap: "10px", minHeight: 0 }}
          >
            <div
              className="panel-side"
              style={{
                width: "320px",
                flexShrink: 0,
                opacity: 0.7,
                transition: "opacity 0.18s ease",
              }}
            >
              <InputConsole />
            </div>
            <div style={{ flex: 1, minWidth: 0, opacity: 1 }}>
              <CoreVisualization />
            </div>
            <div
              className="panel-side"
              style={{
                width: "320px",
                flexShrink: 0,
                opacity: 0.85,
                transition: "opacity 0.18s ease",
              }}
            >
              <AnalysisEngine />
            </div>
          </div>
        )}

        {currentView === "model" && (
          <div className="panel" style={{ flex: 1, overflow: "auto" }}>
            <CompareView />
          </div>
        )}

        {currentView === "rag" && (
          <div className="panel" style={{ flex: 1, overflow: "auto" }}>
            <RagView />
          </div>
        )}
      </div>
    </div>
  );
};
