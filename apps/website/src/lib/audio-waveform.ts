export interface AudioWaveformData {
  amplitudes: number[];
  durationSeconds: number;
}

export const extractAmplitudeBuckets = (
  buffer: Pick<
    AudioBuffer,
    "duration" | "length" | "numberOfChannels" | "getChannelData"
  >,
  bucketCount = 160
): AudioWaveformData => {
  const safeBucketCount = Math.max(1, Math.floor(bucketCount)),
   amplitudes = Array.from({ length: safeBucketCount }, () => 0),
   channelCount = Math.max(1, buffer.numberOfChannels),
   samplesPerBucket = Math.max(
    1,
    Math.ceil(buffer.length / safeBucketCount)
  );

  for (let bucket = 0; bucket < safeBucketCount; bucket += 1) {
    const start = bucket * samplesPerBucket,
     end = Math.min(buffer.length, start + samplesPerBucket);
    let peak = 0;

    for (let channel = 0; channel < channelCount; channel += 1) {
      const samples = buffer.getChannelData(channel);
      for (let index = start; index < end; index += 1) {
        peak = Math.max(peak, Math.abs(samples[index] ?? 0));
      }
    }

    amplitudes[bucket] = Math.max(0.04, Math.min(1, peak));
  }

  return {
    amplitudes,
    durationSeconds: buffer.duration,
  };
};

export const decodeAudioWaveform = async (
  file: Blob,
  bucketCount = 160
): Promise<AudioWaveformData> => {
  const AudioContextClass =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error("This browser cannot analyze audio files.");
  }

  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    return extractAmplitudeBuckets(buffer, bucketCount);
  } finally {
    await context.close();
  }
};
