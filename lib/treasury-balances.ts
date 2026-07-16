import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddressSync, getMint } from '@solana/spl-token';
import { FAM_TOKENS, formatTokenBalance, getSolanaRpcUrl } from '@/lib/fam-tokens';
import { resolveTreasuryPublicKey } from '@/lib/treasury';

export type TreasuryTokenBalance = {
  id: string;
  symbol: string;
  mint: string;
  ata: string;
  accountExists: boolean;
  balance: string;
  raw: string;
};

export type TreasurySnapshot = {
  treasury: string;
  sol: number;
  solLamports: number;
  tokens: TreasuryTokenBalance[];
  fundedTokenCount: number;
  fetchedAt: string;
};

export async function fetchTreasurySnapshot(
  endpoint = getSolanaRpcUrl(),
): Promise<TreasurySnapshot> {
  const connection = new Connection(endpoint, 'confirmed');
  const treasury = resolveTreasuryPublicKey();

  const [solLamports, tokenRows] = await Promise.all([
    connection.getBalance(treasury, 'confirmed'),
    Promise.all(
      FAM_TOKENS.map(async token => {
        const mint = new PublicKey(token.mint);
        const ata = getAssociatedTokenAddressSync(mint, treasury);
        try {
          const [account, mintInfo] = await Promise.all([
            getAccount(connection, ata),
            getMint(connection, mint),
          ]);
          return {
            id: token.id,
            symbol: token.symbol,
            mint: token.mint,
            ata: ata.toBase58(),
            accountExists: true,
            balance: formatTokenBalance(account.amount, mintInfo.decimals),
            raw: account.amount.toString(),
          } satisfies TreasuryTokenBalance;
        } catch {
          return {
            id: token.id,
            symbol: token.symbol,
            mint: token.mint,
            ata: ata.toBase58(),
            accountExists: false,
            balance: '0',
            raw: '0',
          } satisfies TreasuryTokenBalance;
        }
      }),
    ),
  ]);

  const fundedTokenCount = tokenRows.filter(
    t => t.accountExists && BigInt(t.raw) > BigInt(0),
  ).length;

  return {
    treasury: treasury.toBase58(),
    sol: solLamports / LAMPORTS_PER_SOL,
    solLamports,
    tokens: tokenRows,
    fundedTokenCount,
    fetchedAt: new Date().toISOString(),
  };
}