import { PublicKey } from "@solana/web3.js";
import client from "../shared/client";
import { FractionConfig } from "../types";

/*
* Get a fraction by a participant
* @param participant - The participant to get the fraction for
* @returns The fraction
*/
export async function getFractionsByParticipant(participant: PublicKey) {
    const fraction = await client.account.fractionConfig.all()

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
export async function getFractionsByConfig(config: PublicKey) {
    const fraction = await client.account.fractionConfig.fetch(config)
    return fraction as FractionConfig
}

// TODO
export async function getFractionBalance(config: PublicKey) {
    const fraction = await client.account.fractionConfig.fetch(config)
    return fraction
}