#!/usr/bin/env node
/** Check shared treasury SOL + all Fam SPL token accounts on mainnet. */
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getAccount, getMint } from '@solana/spl-token';

const TREASURY = process.env.TREASURY_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_TREASURY_PUBLIC_KEY ?? '8w1KpwzpAttJAonNHohTyAhzcw4iYuCrQPhppPRw5ASb';
const RPC = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

const FAM_MINTS = {
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  BONGA: '7YoAymCyauHAXus3snMEKcLgRx546MrHuBW3EuUNKKQs',
  BONG: 'HnJ1rwyEZcSMWjXQX4XruLFWqmqquGdXn9zJsRakQFex',
  BINK: '4QYomLMUbPaqrqRuF3LBbJjE1g1LrE9XMoU4KMuejiJ7',
  BONNIE: 'DSKSUL26jPUd2qWfibvVNC5yUucjokfvnNYbhzViHtsp',
  BENG: 'BPivnge2WgisHu7HE4JrCE6aiqyDdbs7NrVWiYTWsaX4',
};

const connection = new Connection(RPC, 'confirmed');
const treasuryPk = new PublicKey(TREASURY);
const sol = await connection.getBalance(treasuryPk);

console.log('\n=== Bonklandia Shared Treasury ===\n');
console.log('Treasury:', TREASURY);
console.log('SOL:     ', (sol / 1e9).toFixed(4), '\n');

for (const [symbol, mintStr] of Object.entries(FAM_MINTS)) {
  const mint = new PublicKey(mintStr);
  const ata = getAssociatedTokenAddressSync(mint, treasuryPk);
  try {
    const [account, mintInfo] = await Promise.all([
      getAccount(connection, ata),
      getMint(connection, mint),
    ]);
    const human = Number(account.amount) / 10 ** mintInfo.decimals;
    console.log(`${symbol.padEnd(7)} ATA exists · balance ${human.toLocaleString()}`);
    console.log(`        ${ata.toBase58()}`);
  } catch {
    console.log(`${symbol.padEnd(7)} NO TOKEN ACCOUNT`);
    console.log(`        expected ATA: ${ata.toBase58()}`);
  }
}

console.log('');