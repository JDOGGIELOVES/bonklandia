import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

/** Same network as Bonga Bonk Miner / GrokSight — mainnet by default. */
const NETWORK_RAW = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'mainnet-beta';

export const WALLET_NETWORK: WalletAdapterNetwork =
  NETWORK_RAW === 'devnet'
    ? WalletAdapterNetwork.Devnet
    : NETWORK_RAW === 'testnet'
      ? WalletAdapterNetwork.Testnet
      : WalletAdapterNetwork.Mainnet;

export const WALLET_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  process.env.SOLANA_RPC_URL ??
  clusterApiUrl(WALLET_NETWORK);

/**
 * Shared Bonklandia treasury — same wallet as Bonga Bonk Miner, GrokSight (bonklandia.com).
 * @see https://explorer.solana.com/address/8w1KpwzpAttJAonNHohTyAhzcw4iYuCrQPhppPRw5ASb
 */
export const TREASURY_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_TREASURY_PUBLIC_KEY ??
  process.env.TREASURY_PUBLIC_KEY ??
  '8w1KpwzpAttJAonNHohTyAhzcw4iYuCrQPhppPRw5ASb';

export function getExplorerAddressUrl(address: string): string {
  const cluster =
    WALLET_NETWORK === WalletAdapterNetwork.Mainnet ? '' : `?cluster=${NETWORK_RAW}`;
  return `https://explorer.solana.com/address/${address}${cluster}`;
}

export function getExplorerTxUrl(signature: string): string {
  const cluster =
    WALLET_NETWORK === WalletAdapterNetwork.Mainnet ? '' : `?cluster=${NETWORK_RAW}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}