import { parseArgs } from "util";
import { exit } from "process";
import type { Chain } from "viem";
import * as chains from "viem/chains";

const chainMap: Record<string, Chain> = {};
for (const [k, v] of Object.entries(chains)) {
  chainMap[k] = v;
}

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    network: {
      type: "string",
    },
  },
  strict: true,
  allowPositionals: true,
});

if (!values.network) {
  console.error("Network required");
  exit(1);
}

const chain: Chain = chainMap[values.network];
console.log(chain.rpcUrls.default.http[0]);
