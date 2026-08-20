export const recordRealtimeMetric = ({
  dataset,
  event,
  doubles = [],
  indexes = [],
}: {
  dataset?: AnalyticsEngineDataset;
  doubles?: number[];
  event: string;
  indexes?: string[];
}) => {
  if (!dataset) {
    return;
  }

  try {
    dataset.writeDataPoint({
      blobs: [event],
      doubles,
      indexes,
    });
  } catch (error) {
    console.warn("Realtime metric write failed", {
      error: error instanceof Error ? error.message : String(error),
      event,
    });
  }
};
