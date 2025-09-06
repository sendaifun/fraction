import { Connection, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import  { programId } from "../shared/client";
import { CreatorFractionInputArgs, UpdateFractionInputArgs } from "../types";
import { getFractionsByConfig } from "../state";
import { Program } from "@coral-xyz/anchor";
import { Fraction } from "../shared/idl";

/**
 * Create a fraction instruction
 * @param input - The input arguments for creating a fraction
 * @returns The instruction
 */
async function updateFractionIx(program: Program<Fraction>, config: PublicKey, input: UpdateFractionInputArgs) {

    const { participants } = input;
    let botWallet = input.botWallet;

    const fraction = await getFractionsByConfig(program, config)

    if (!fraction) {
        throw new Error("Fraction not found")
    }

    if(!botWallet) {
        botWallet = fraction.botWallet;
    }

    participants.forEach(participant => {
        if (!participant.wallet) {
            throw new Error("Participant wallet is required")
        }

        if (participant.wallet == SystemProgram.programId && participant.shareBps != 0)
            throw new Error("System program cannot have a share")

        if (participant.shareBps > 10000)
            throw new Error("Share cannot be greater than 10000")
    })

    const ix = await program.methods.updateFraction(
        fraction.name,
        participants,
        botWallet,
    ).accountsPartial({
        authority: fraction.authority,
        fractionConfig: config,
    }).instruction()

    return ix
}

/**
 * Update a fraction
 * @param config - The config of the fraction
 * @param input - The input arguments for updating a fraction
 * @param connection - The connection to use for the transaction
 * @param payer - The payer for the transaction
 * @returns The transaction
 */
async function updateFraction(program: Program<Fraction>, config: PublicKey, input: UpdateFractionInputArgs, connection?: Connection, payer?: PublicKey) {
    const ix = await updateFractionIx(program, config, input)

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

export { updateFraction, updateFractionIx }