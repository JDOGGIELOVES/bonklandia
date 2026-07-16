import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from '@solana/web3.js';

export function checkTreasuryTxSafety(
  tx: Transaction,
  treasuryPubkey: PublicKey,
  expectedTreasuryAta: PublicKey,
  expectedRecipientAta: PublicKey,
  mint: PublicKey,
): { shouldBlock: boolean; message?: string } {
  if (tx.instructions.length !== 1) {
    return { shouldBlock: true, message: 'Treasury tx must contain exactly one SPL transfer.' };
  }

  const ix: TransactionInstruction = tx.instructions[0];

  if (!ix.programId.equals(TOKEN_PROGRAM_ID)) {
    return { shouldBlock: true, message: 'Only SPL Token transfers are allowed — treasury never sends SOL.' };
  }

  const data = ix.data;
  if (!data || data.length < 9 || data[0] !== 12) {
    return { shouldBlock: true, message: 'Instruction must be transferChecked only.' };
  }

  const keys = ix.keys;
  if (keys.length < 4) {
    return { shouldBlock: true, message: 'Invalid transferChecked accounts.' };
  }

  if (!keys[0].pubkey.equals(expectedTreasuryAta)) {
    return { shouldBlock: true, message: 'Source must be treasury token account.' };
  }
  if (!keys[1].pubkey.equals(mint)) {
    return { shouldBlock: true, message: 'Mint mismatch.' };
  }
  if (!keys[2].pubkey.equals(expectedRecipientAta)) {
    return { shouldBlock: true, message: 'Destination must be player token account.' };
  }
  if (!keys[3].pubkey.equals(treasuryPubkey)) {
    return { shouldBlock: true, message: 'Treasury must sign the transfer.' };
  }

  for (const instruction of tx.instructions) {
    if (instruction.programId.equals(SystemProgram.programId)) {
      return { shouldBlock: true, message: 'SystemProgram instructions blocked — treasury never pays SOL.' };
    }
    if (instruction.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
      return { shouldBlock: true, message: 'ATA creation blocked — players must already have token accounts.' };
    }
  }

  return { shouldBlock: false };
}

export async function recipientTokenAccountExists(
  connection: Connection,
  recipientAta: PublicKey,
): Promise<boolean> {
  try {
    await getAccount(connection, recipientAta);
    return true;
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) return false;
    throw err;
  }
}

export function buildTreasurySplTransferOnly(
  treasury: PublicKey,
  recipient: PublicKey,
  mint: PublicKey,
  rawAmount: bigint,
  decimals: number,
): { transaction: Transaction; treasuryAta: PublicKey; recipientAta: PublicKey } {
  const treasuryAta = getAssociatedTokenAddressSync(mint, treasury, false, TOKEN_PROGRAM_ID);
  const recipientAta = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_PROGRAM_ID);

  const tx = new Transaction().add(
    createTransferCheckedInstruction(
      treasuryAta,
      mint,
      recipientAta,
      treasury,
      rawAmount,
      decimals,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  return { transaction: tx, treasuryAta, recipientAta };
}

export async function simulateTreasuryTransfer(
  connection: Connection,
  tx: Transaction,
  treasury: Keypair,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = treasury.publicKey;
  tx.sign(treasury);

  const simulation = await connection.simulateTransaction(tx, [treasury]);
  if (simulation.value.err) {
    return {
      ok: false,
      error: `Transfer simulation failed: ${JSON.stringify(simulation.value.err)}`,
    };
  }

  return { ok: true };
}