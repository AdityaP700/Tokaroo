export function mockSimulation(input: any) {
  const numChunks = input.top_k || 5;
  const chunks = [];
  const edges = [];
  const attention = [];

  // Generate mock chunks
  for (let i = 0; i < numChunks; i++) {
    const chunkId = `chunk-${i}`;
    chunks.push({
      id: chunkId,
      chunk_index: i,
      size: input.chunk_size || 120, // tokens
      relevance: 0.5 + Math.random() * 0.5,
      attention: 0.2 + Math.random() * 0.8,
      risk_level: Math.random() > 0.8 ? 'high' : 'low',
      boundary_snippet: `Mock snippet content for chunk ${i}...`,
    });
    attention.push(0.2 + Math.random() * 0.8);
  }

  // Generate mock edges (linking sequential chunks and random ones for semantic similarity)
  for (let i = 0; i < numChunks - 1; i++) {
    edges.push({
      source: `chunk-${i}`,
      target: `chunk-${i + 1}`,
      weight: 0.8,
    });
    
    // Add occasional cross-link
    if (Math.random() > 0.6 && i + 2 < numChunks) {
      edges.push({
        source: `chunk-${i}`,
        target: `chunk-${i + 2}`,
        weight: 0.4 + Math.random() * 0.4,
      });
    }
  }

  return {
    chunks,
    edges,
    attention,
  };
}
