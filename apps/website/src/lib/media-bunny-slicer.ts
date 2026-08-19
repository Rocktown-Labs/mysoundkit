/**
 * MediaBunny Audio Slicing Utility
 * High-performance client-side audio slicing and WAV buffer encoding.
 * Extracts hook & open slot snippets directly in the browser without server cost.
 */

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels,
    sampleRate = buffer.sampleRate,
    format = 1, // PCM
    bitDepth = 16,
    bytesPerSample = bitDepth / 8,
    blockAlign = numChannels * bytesPerSample,
    numSamples = buffer.length,
    dataSize = numSamples * blockAlign,
    headerSize = 44,
    totalSize = headerSize + dataSize,
    arrayBuffer = new ArrayBuffer(totalSize),
    view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // "fmt " sub-chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave and write 16-bit PCM samples
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

export async function sliceAudioFileToSnippet(
  source: File | Blob | string,
  startSec: number,
  endSec: number,
  outputFileName = "open-verse-hook-stub.wav"
): Promise<File> {
  let arrayBuffer: ArrayBuffer;

  if (typeof source === "string") {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch audio source: ${res.statusText}`);
    }
    arrayBuffer = await res.arrayBuffer();
  } else {
    arrayBuffer = await source.arrayBuffer();
  }

  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  
  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const sampleRate = decodedBuffer.sampleRate;
    const numChannels = decodedBuffer.numberOfChannels;

    const safeStartSec = Math.max(0, Math.min(startSec, decodedBuffer.duration - 1));
    const safeEndSec = Math.max(safeStartSec + 1, Math.min(endSec, decodedBuffer.duration));
    
    const startSample = Math.floor(safeStartSec * sampleRate);
    const endSample = Math.floor(safeEndSec * sampleRate);
    const snippetLength = endSample - startSample;

    const snippetBuffer = audioCtx.createBuffer(numChannels, snippetLength, sampleRate);

    // Apply a subtle 50ms micro-fade in/out to avoid harsh digital clicks at the slice boundaries
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.05), Math.floor(snippetLength / 4));

    for (let c = 0; c < numChannels; c++) {
      const sourceChannel = decodedBuffer.getChannelData(c);
      const snippetChannel = snippetBuffer.getChannelData(c);

      for (let i = 0; i < snippetLength; i++) {
        let sample = sourceChannel[startSample + i];

        // Fade in
        if (i < fadeSamples) {
          sample *= (i / fadeSamples);
        }
        // Fade out
        else if (i > snippetLength - fadeSamples) {
          sample *= ((snippetLength - i) / fadeSamples);
        }

        snippetChannel[i] = sample;
      }
    }

    const wavArrayBuffer = audioBufferToWav(snippetBuffer);
    return new File([wavArrayBuffer], outputFileName, { type: "audio/wav" });
  } finally {
    audioCtx.close().catch(() => {});
  }
}
