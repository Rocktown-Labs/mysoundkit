const PREVIEW_SECONDS = 30;
const WAV_HEADER_BYTES = 44;

const writeAscii = (view: DataView, offset: number, value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const encodeWav = (buffer: AudioBuffer) => {
  const channelCount = Math.min(buffer.numberOfChannels, 2);
  const frameCount = Math.min(
    buffer.length,
    Math.floor(buffer.sampleRate * PREVIEW_SECONDS)
  );
  const dataBytes = frameCount * channelCount * 2;
  const output = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(output);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = WAV_HEADER_BYTES;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  }

  return new Blob([output], { type: "audio/wav" });
};

export const createAudioPreviewFile = async (file: File): Promise<File | null> => {
  if (!file.type.startsWith("audio/")) {
    return null;
  }

  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const preview = encodeWav(buffer);
    const baseName = file.name.replace(/\.[^.]+$/u, "");
    return new File([preview], `${baseName}.preview.wav`, { type: "audio/wav" });
  } finally {
    await context.close();
  }
};
