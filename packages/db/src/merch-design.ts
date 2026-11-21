/* eslint-disable sort-vars -- Geometry values are calculated in dependency order. */
export interface MerchPosition {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface MerchPrintArea {
  placement: string;
  technique: "dtg";
  width: number;
  height: number;
  dpi: number;
}
export interface MerchEditorConfig {
  version: 1;
  position: MerchPosition;
  variantIds: string[];
  artwork: { width: number; height: number };
  printArea: MerchPrintArea;
}

export function fitMerchArtwork(
  area: MerchPrintArea,
  artwork: { width: number; height: number }
): MerchPosition {
  const scale = Math.min(
      (area.width * 0.8) / artwork.width,
      (area.height * 0.8) / artwork.height
    ),
    width = artwork.width * scale,
    height = artwork.height * scale;
  return {
    height,
    left: (area.width - width) / 2,
    top: (area.height - height) / 2,
    width,
  };
}
export function clampMerchPosition(
  position: MerchPosition,
  area: MerchPrintArea
): MerchPosition {
  const width = Math.max(0.01, Math.min(area.width, position.width)),
    height = Math.max(0.01, Math.min(area.height, position.height));
  return {
    height,
    left: Math.max(0, Math.min(area.width - width, position.left)),
    top: Math.max(0, Math.min(area.height - height, position.top)),
    width,
  };
}
