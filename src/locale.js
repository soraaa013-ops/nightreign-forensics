// Display labels only: identifiers, pools, weights and source snapshots remain intact.
export function localizeRelics(data, dictionary) {
  return {
    ...data,
    metadata: {
      ...data.metadata,
      label: data.metadata.label
        .replace("Public snapshot", "社区快照")
        .replace("DLC", "扩展内容"),
    },
    templates: data.templates.map((item) => ({
      ...item,
      name: dictionary.relic[item.name] ?? item.name,
    })),
    effects: Object.fromEntries(
      Object.entries(data.effects).map(([id, item]) => [
        id,
        { ...item, name: dictionary.relic[item.name] ?? item.name },
      ]),
    ),
  };
}
export async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`数据请求失败（${response.status}）`);
  return response.json();
}
