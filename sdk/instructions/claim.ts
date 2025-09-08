import { Connection, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import  { programId } from "../shared/client";
import { CreatorFractionInputArgs, UpdateFractionInputArgs } from "../types";
import { getFractionsByConfig } from "../state";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Fraction } from "../shared/idl";
import { Program } from "@coral-xyz/anchor";

/**
 * Claim and distribute instruction
 * @param input - The input arguments for creating a fraction
 * @returns The instruction
 */
async function claimAndDistributeIx(program: Program<Fraction>, config: PublicKey, mint: PublicKey) {


    const fraction = await getFractionsByConfig(program, config)

    if (!fraction) {
        throw new Error("Fraction not found")
    }

    const treasuryAssociatedTokenAccount = getAssociatedTokenAddressSync(
        mint,
        config,
        true
    )

    const participantsAssociatedTokenAccount = 
        fraction.participants.map((participant) => {
            return getAssociatedTokenAddressSync(
                mint,
                participant.wallet,
                true
            )
        })

    const botAssociatedTokenAccount = getAssociatedTokenAddressSync(
        mint,
        fraction.botWallet,
        true
    )

    const ix = await program.methods.claimAndDistribute().accountsStrict({
        authority: fraction.authority,
        botWallet: fraction.botWallet,
        fractionConfig: config,
        treasury: treasuryAssociatedTokenAccount,
        treasuryMint: mint,
        tempWsolAccount: null,
        botTokenAccount: botAssociatedTokenAccount,
        participantTokenAccount0: participantsAssociatedTokenAccount[0],
        participantTokenAccount1: participantsAssociatedTokenAccount[1],
        participantTokenAccount2: participantsAssociatedTokenAccount[2],
        participantTokenAccount3: participantsAssociatedTokenAccount[3],
        participantTokenAccount4: participantsAssociatedTokenAccount[4],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
    }).instruction()

    return ix
}

/**
 * Claim and distribute
 * @param config - The config of the fraction
 * @param mint - The mint of the token
 * @param connection - The connection to use for the transaction
 * @param payer - The payer for the transaction
 * @returns The transaction
 */
async function claimAndDistribute(program: Program<Fraction>, config: PublicKey, mint: PublicKey, connection?: Connection, payer?: PublicKey) {
    const ix = await claimAndDistributeIx(program, config, mint)

    if (connection && payer) {
        const { blockhash } = await connection.getLatestBlockhash()
        const messageV0 = new TransactionMessage({
            payerKey: payer, // PublicKey of the fee payer
            recentBlockhash: blockhash,
            instructions: [ix],
        }).compileToV0Message();

        const tx = new VersionedTransaction(messageV0)
        return tx
    } else {
        const tx = new Transaction().add(ix)
        return tx
    }
}

export { claimAndDistribute, claimAndDistributeIx }