import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'storekit/Bookey.storekit');
const nativeConfig = resolve(root, 'ios/Bookey.storekit');
const schemePath = resolve(root, 'ios/bookey.xcodeproj/xcshareddata/xcschemes/bookey.xcscheme');

await copyFile(source, nativeConfig);

const marker = 'StoreKitConfigurationFileReference';
let scheme = await readFile(schemePath, 'utf8');
if (!scheme.includes(marker)) {
  scheme = scheme.replace(
    /(<LaunchAction[\s\S]*?allowLocationSimulation = "YES">)/,
    `$1\n      <StoreKitConfigurationFileReference\n         identifier = "../../Bookey.storekit">\n      </StoreKitConfigurationFileReference>`,
  );
  await writeFile(schemePath, scheme);
}

console.log('Local StoreKit configuration enabled for the bookey Debug scheme.');
