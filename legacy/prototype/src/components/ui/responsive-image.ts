export function responsiveToolImageSource(src: string) {
  if (!/^(?:\.\/|\/)tool-images\//.test(src)) return undefined;
  const match = src.match(/^(.*\/)([^/]+)\.jpg$/i);
  if (!match || /-(?:320|640)$/.test(match[2])) return undefined;
  return `${match[1]}${match[2]}-320.jpg 320w, ${match[1]}${match[2]}-640.jpg 640w, ${src} 1024w`;
}
