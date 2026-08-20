/**
 * MediaBunny Audio Slicing Utility
 * High-performance client-side audio slicing and WAV buffer encoding.
 * Extracts hook & open slot snippets directly in the browser without server cost.
 */

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const { numberOfChannels: numChannels, sampleRate } = buffer,
    bitDepth = 16,
    bytesPerSample = bitDepth / 8,
    blockAlign = numChannels * bytesPerSample,
    numSamples = buffer.length,
    dataSize = numSamples * blockAlign,
    headerSize = 44,
    totalSize = headerSize + dataSize,
    arrayBuffer = new ArrayBuffer(totalSize),
    view = new DataView(arrayBuffer),
    channelData: Float32Array[] = [],
    writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i += 1) {
        view.setUint8(offset + i, str.codePointAt(i) ?? 0);
      }
    };

  // RIFF chunk descriptor
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // "fmt " sub-chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  // PCM format
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave and write 16-bit PCM samples
  for (let c = 0; c < numChannels; c += 1) {
    channelData.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[c]?.[i] ?? 0)),
        intSample = sample < 0 ? sample * 0x80_00 : sample * 0x7F_FF;
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

  const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext,
    audioCtx = new AudioContextClass();

  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer),
      { numberOfChannels: numChannels, sampleRate } = decodedBuffer,
      safeStartSec = Math.max(
        0,
        Math.min(startSec, decodedBuffer.duration - 1)
      ),
      safeEndSec = Math.max(
        safeStartSec + 1,
        Math.min(endSec, decodedBuffer.duration)
      ),
      startSample = Math.floor(safeStartSec * sampleRate),
      endSample = Math.floor(safeEndSec * sampleRate),
      snippetLength = endSample - startSample,
      snippetBuffer = audioCtx.createBuffer(
        numChannels,
        snippetLength,
        sampleRate
      ),
      // Subtle 50ms micro-fade in/out to avoid harsh digital clicks at slice boundaries
      fadeSamples = Math.min(
        Math.floor(sampleRate * 0.05),
        Math.floor(snippetLength / 4)
      );

    for (let c = 0; c < numChannels; c += 1) {
      const snippetChannel = snippetBuffer.getChannelData(c),
        sourceChannel = decodedBuffer.getChannelData(c);

      for (let i = 0; i < snippetLength; i += 1) {
        let sample = sourceChannel[startSample + i] ?? 0;

        if (i < fadeSamples) {
          sample *= i / fadeSamples;
        } else if (i > snippetLength - fadeSamples) {
          sample *= (snippetLength - i) / fadeSamples;
        }

        snippetChannel[i] = sample;
      }
    }

    const wavArrayBuffer = audioBufferToWav(snippetBuffer);
    return new File([wavArrayBuffer], outputFileName, { type: "audio/wav" });
  } finally {
    try {
      await audioCtx.close();
    } catch {
      // AudioContext close ignored
    }
  }
}
