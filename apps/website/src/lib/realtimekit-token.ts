export const isMockRealtimeKitToken = (authToken: string) =>
  authToken.startsWith("mock_rtk_");
