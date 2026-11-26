// Writes the brand files in zharf/overrides from one source: zharf/brand/mark.svg (the ZharfAI
// mark, from the ZharfAI stationery kit). Run after changing the mark:
//
//   node zharf/brand/make-overrides.ts
//
// Binary icons (PNG, ICO) are exported separately by make-icons.ts.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const brandDir = NodePath.dirname(new URL(import.meta.url).pathname);
const overrides = NodePath.join(brandDir, "..", "overrides");

const markSvg = NodeFS.readFileSync(NodePath.join(brandDir, "mark.svg"), "utf8");
const markPath = /\sd="([^"]+)"/.exec(markSvg)?.[1];
const viewBox = /viewBox="([^"]+)"/.exec(markSvg)?.[1];
if (!markPath || !viewBox) throw new Error("mark.svg needs one path and a viewBox");
const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number) as [
  number,
  number,
  number,
  number,
];

function write(rel: string, text: string) {
  const file = NodePath.join(overrides, rel);
  NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
  NodeFS.writeFileSync(file, text);
}

// Icon Composer layer: 128-unit canvas, the mark 80 units wide, centred, white.
const scale = 80 / vbWidth;
const tx = (128 - vbWidth * scale) / 2;
const ty = (128 - vbHeight * scale) / 2;
const layer = (fill: string) =>
  `<path transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})" d="${markPath}" fill="${fill}"/>`;

const iconLayer = `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">\n  ${layer("white")}\n</svg>\n`;
for (const variant of ["prod", "dev", "nightly"]) {
  write(`assets/${variant}/app-icon.icon/Assets/text.svg`, iconLayer);
}
NodeFS.writeFileSync(NodePath.join(brandDir, "mark-layer.svg"), iconLayer);

const roundedSquare =
  "M0 10C0 4.47715 4.47715 0 10 0H118C123.523 0 128 4.47715 128 10V118C128 123.523 123.523 128 118 128H10C4.47715 128 0 123.523 0 118V10Z";
const logo = `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="${roundedSquare}" fill="black"/>\n${layer("white")}\n</svg>\n`;
write("assets/prod/logo.svg", logo);
NodeFS.writeFileSync(NodePath.join(brandDir, "logo.svg"), logo);

const note =
  "// Zharf Code: the ZharfAI mark. The component keeps upstream's name so its call sites merge cleanly.";

write(
  "apps/web/src/components/T3Wordmark.tsx",
  `import type { SVGProps } from "react";

${note}
export function T3Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
      <path
        d="${markPath}"
        fill="currentColor"
      />
    </svg>
  );
}
`,
);

write(
  "apps/mobile/src/components/T3Wordmark.tsx",
  `import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const ThemedPath = withUniwind(Path);

${note}
export function T3Wordmark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  const aspectRatio = ${vbWidth} / ${vbHeight};
  return (
    <Svg
      accessibilityLabel="Zharf Code"
      height={props.height}
      width={props.height * aspectRatio}
      viewBox="${viewBox}"
    >
      <ThemedPath
        d="${markPath}"
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
}
`,
);

// The DMG window background (640×432 points at 2×): the mark top left, the drag hint, the arrow.
const markHeight = 22;
const markWidth = (markHeight * vbWidth) / vbHeight;
const dmg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="864" viewBox="0 0 640 432">
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#B7B7B7" stop-opacity="0"/>
      <stop offset=".55" stop-color="#A5A5A5" stop-opacity=".24"/>
      <stop offset="1" stop-color="#D1D1D1" stop-opacity=".4"/>
    </linearGradient>
  </defs>
  <rect width="640" height="432" fill="#E9E9EB"/>
  <path d="M-60 293C95 220 214 304 362 256S559 191 707 257" stroke="url(#veil)" stroke-width="146" fill="none" stroke-linecap="round"/>
  <!-- The ZharfAI mark, from zharf/brand/mark.svg. -->
  <svg x="32" y="21" width="${markWidth.toFixed(2)}" height="${markHeight}" viewBox="${viewBox}" fill="#303034">
    <path d="${markPath}"/>
  </svg>
  <text x="${(32 + markWidth + 8).toFixed(2)}" y="38" fill="#303034" font-family="Helvetica" font-size="15" font-weight="700">Zharf Code</text>
  <text x="320" y="104" fill="#303034" font-family="Helvetica" font-size="23" font-weight="700" text-anchor="middle">Drag Zharf Code into Applications.</text>
  <path d="M270 204Q320 179 370 204M358 190L370 204L351 209" stroke="#505057" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="320" y="367" fill="#626269" font-family="Helvetica" font-size="12" font-weight="400" text-anchor="middle">Once copied, open it from Applications.</text>
</svg>
`;
write("apps/desktop/resources/dmg/dmg-background-latest.svg", dmg);
write("apps/desktop/resources/dmg/dmg-background-nightly.svg", dmg);

console.log(`wrote brand overrides into ${overrides}`);
