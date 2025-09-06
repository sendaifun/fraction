import { PublicKey } from "@solana/web3.js";
import  { programId } from "../shared/client";
import { FractionConfig } from "../types";
import { Program } from "@coral-xyz/anchor";
import { Fraction } from "../shared/idl";

/*
* Get a fraction by a participant
* @param participant - The participant to get the fraction for
* @returns The fraction
*/
export async function getFractionsByParticipant(program: Program<Fraction>, participant: PublicKey) {
    const fraction = await program.account.fractionConfig.all()

    let foundFraction = [] as FractionConfig[]

    fraction.forEach(fraction => {
        if (fraction.account.participants.some(p => p.wallet == participant)) {
            foundFraction.push(fraction.account)
        }
    })

    return foundFraction
}


/*
* Get a fraction by a participant
* @param participant - The participant to get the fraction for
* @returns The fraction
*/
export async function getFractionsByConfig(program: Program<Fraction>, config: PublicKey) {
    const fraction = await program.account.fractionConfig.fetch(config)
    return fraction as FractionConfig
}

// TODO
export async function getFractionBalance(program: Program<Fraction>, config: PublicKey) {
    const fraction = await program.account.fractionConfig.fetch(config)
    return fraction
}