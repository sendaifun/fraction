import { Connection, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import  { programId } from "../shared/client";
import { CreatorFractionInputArgs } from "../types";
import { Program } from "@coral-xyz/anchor";
import { Fraction } from "../shared/idl";

/**
 * Create a fraction instruction
 * @param input - The input arguments for creating a fraction
 * @returns The instruction
 */
async function createFractionIx(program: Program<Fraction>, input: CreatorFractionInputArgs) {

    const { participants, authority, name, botWallet } = input;

    let fractionName = name ? name : `${authority.toBase58().slice(0, 8)}-${Date.now().toString().slice(0, 8)}`;

    const [fractionConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fraction_config"), authority.toBuffer(), Buffer.from(fractionName)],
        programId
    );

    const [fractionVaultPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("fraction_vault"),
          authority.toBuffer(),
          Buffer.from(fractionName),
        ],
        program.programId
      );

    participants.forEach(participant => {
        if (!participant.wallet) {
            throw new Error("Participant wallet is required")
        }

        if (participant.wallet == SystemProgram.programId && participant.shareBps != 0)
            throw new Error("System program cannot have a share")

        if (participant.shareBps > 10000)
            throw new Error("Share cannot be greater than 10000")
    })

    const ix = await program.methods.initializeFraction(
        fractionName,
        participants,
        botWallet,
    ).accountsStrict({
        authority,
        fractionVault: fractionVaultPda,
        fractionConfig: fractionConfigPda,
        systemProgram: SystemProgram.programId,
    }).instruction()

    return {ix, fractionConfigPda, fractionVaultPda}
}

/**
 * Create a fraction
 * @param input - The input arguments for creating a fraction
 * @param connection - The connection to use for the transaction
 * @param payer - The payer for the transaction
 * @returns The transaction
 */
async function createFraction(program: Program<Fraction>, input: CreatorFractionInputArgs, connection?: Connection, payer?: PublicKey) {
    const {ix, fractionConfigPda, fractionVaultPda} = await createFractionIx(program, input)

    if (connection && payer) {
        const { blockhash } = await connection.getLatestBlockhash()
        const messageV0 = new TransactionMessage({
            payerKey: payer, // PublicKey of the fee payer
            recentBlockhash: blockhash,
            instructions: [ix],
        }).compileToV0Message();

        const tx = new VersionedTransaction(messageV0)
        return {tx, fractionConfigPda, fractionVaultPda}
    } else {
        const tx = new Transaction().add(ix)
        return {tx, fractionConfigPda, fractionVaultPda}
    }
}

export { createFraction, createFractionIx }