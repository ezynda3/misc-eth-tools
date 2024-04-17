import { parseArgs } from "util";
import { exit } from "process";
import { type SafeApiKitConfig } from "@safe-global/api-kit";
import type { Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EthersAdapter } from "@safe-global/protocol-kit";
import { ethers } from "ethers";
import {
  OperationType,
  type SafeTransactionDataPartial,
} from "@safe-global/safe-core-sdk-types";
import * as chains from "viem/chains";

const chainMap: Record<string, Chain> = {};
for (const [k, v] of Object.entries(chains)) {
  chainMap[k] = v;
}

export const TRANSACTION_SERVICE_URLS: Record<string, string> = {
  "1": "https://safe-transaction-mainnet.safe.global/api",
  "10": "https://safe-transaction-optimism.safe.global/api",
  "56": "https://safe-transaction-bsc.safe.global/api",
  "100": "https://safe-transaction-gnosis-chain.safe.global/api",
  "137": "https://safe-transaction-polygon.safe.global/api",
  "324": "https://safe-transaction-zksync.safe.global/api",
  "1101": "https://safe-transaction-zkevm.safe.global/api",
  "8453": "https://safe-transaction-base.safe.global/api",
  "42161": "https://safe-transaction-arbitrum.safe.global/api",
  "42220": "https://safe-transaction-celo.safe.global/api",
  "43114": "https://safe-transaction-avalanche.safe.global/api",
  "84532": "https://safe-transaction-base-sepolia.safe.global/api",
  "11155111": "https://safe-transaction-sepolia.safe.global/api",
  "1313161554": "https://safe-transaction-aurora.safe.global/api",
  "288": "https://safe-transaction.mainnet.boba.network/api",
  "250": "https://safe-txservice.fantom.network/api",
  "1284": "https://transaction.multisig.moonbeam.network/api",
  "1285": "https://transaction.moonriver.multisig.moonbeam.network/api",
};

const main = async () => {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      network: {
        type: "string",
      },
      privateKey: {
        type: "string",
      },
      to: {
        type: "string",
      },
      calldata: {
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

  if (!values.privateKey) {
    console.error("Private key required");
    exit(1);
  }

  if (!values.to) {
    console.error("To address required");
    exit(1);
  }

  if (!values.calldata) {
    console.error("Calldata required");
    exit(1);
  }

  const chain: Chain = chainMap[values.network];

  const account = privateKeyToAccount(
    ("0x" + values.privateKey) as `0x${string}`,
  );

  const config: SafeApiKitConfig = {
    chainId: BigInt(chain.id),
    txServiceUrl: TRANSACTION_SERVICE_URLS[chain.id.toString()],
  };

  const SafeApiKit = require("@safe-global/api-kit").default;
  const safeService = new SafeApiKit(config);

  const resp = await safeService.getSafesByOwner(account.address);

  const safeAddress = resp.safes[0];

  const provider = new ethers.JsonRpcProvider(chain.rpcUrls.default.http[0]);
  const signer = new ethers.Wallet(values.privateKey, provider);

  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: signer,
  });

  const Safe = require("@safe-global/protocol-kit").default;
  const protocolKit = await Safe.create({
    ethAdapter,
    safeAddress: safeAddress,
  });

  const nextNonce = await safeService.getNextNonce(safeAddress);
  const safeTransactionData: SafeTransactionDataPartial = {
    to: values.to,
    value: "0", // 1 wei
    data: values.calldata,
    operation: OperationType.Call,
    nonce: nextNonce,
  };

  const safeTransaction = await protocolKit.createTransaction({
    transactions: [safeTransactionData],
  });

  const senderAddress = await signer.getAddress();
  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
  const signature = await protocolKit.signHash(safeTxHash);

  console.info("Signer Address", senderAddress);
  console.info("Safe Address", safeAddress);
  console.info("Network", values.network);
  console.info("Proosing transaction to", values.to);

  // Propose transaction to the service
  await safeService.proposeTransaction({
    safeAddress: await protocolKit.getAddress(),
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress,
    senderSignature: signature.data,
  });

  console.info("Transaction proposed");
};

main().catch((error) => {
  console.error(error);
  exit(1);
});
