const PREVIEW_HYPERDRIVE_NAME = /^soundkit-hyperdrive-pr-(?<number>[1-9]\d*)$/u;

export async function collectClosedPreviewHyperdrives(listPage, getPrState) {
  const configs = [];
  for (let page = 1; ; page += 1) {
    const items = await listPage(page);
    if (!Array.isArray(items)) {
      throw new TypeError(
        "Invalid Hyperdrive list response; refusing cleanup."
      );
    }
    for (const item of items) {
      const match = PREVIEW_HYPERDRIVE_NAME.exec(item.name),
        state = match ? await getPrState(Number(match.groups.number)) : null;
      if (!match) {
        continue;
      }
      if (state === "MERGED" || state === "CLOSED") {
        configs.push({ id: item.id, name: item.name });
      }
    }
    if (items.length < 100) {
      return configs;
    }
  }
}
