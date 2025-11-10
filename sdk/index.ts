import { CreatorFractionInputArgs, UpdateFractionInputArgs } from "./types"
import { PublicKey } from "@solana/web3.js"
import { createFraction, updateFraction, claimAndDistribute } from "./instructions"
import { Connection } from "@solana/web3.js"
import { getFractionsByParticipant, getFractionsByConfig, getFractionBalance, getFractionsByAuthority } from "./state"
import { Program } from "@coral-xyz/anchor"
import { Fraction as FractionIdl } from "./shared/idl"
import { getProgram } from "./shared/client"

export * from "./instructions"
export * from "./state"
export * from "./types"
export * from "./shared"

/**
 * Fraction class
 * This class is used to interact with the Fraction program
 * @param rpc - The RPC endpoint to use for the connection, default is mainnet-beta solana rpc
 * @param payer - The payer to use for the transaction. ( used during constructing transactions )
 */
export class Fraction {
    public rpc?: string
    private connection?: Connection
    private payer?: PublicKey
    private program: Program<FractionIdl>

    /**
     * Constructor
     * @param rpc - The RPC endpoint to use for the connection
     * @param payer - The payer to use for the transaction
     */
    constructor(rpc?: string, payer?: PublicKey) {
        this.rpc = rpc || "https://api.mainnet-beta.solana.com"
        this.connection = new Connection(this.rpc)
        this.payer = payer
        this.program = getProgram(this.connection)
    }

    /**
     * Create a fraction
     * @param input - The input arguments for creating a fraction
     * @returns The transaction
     */
    async createFraction(input: CreatorFractionInputArgs) {
        return createFraction(this.program, input, this.connection, this.payer)
    }

    /**
     * Update a fraction
     * @param config - The config of the fraction
     * @param input - The input arguments for updating a fraction
     * @returns The transaction
     */
    async updateFraction(config: PublicKey, input: UpdateFractionInputArgs) {
        return updateFraction(this.program, config, input, this.connection, this.payer)
    }

    /**
     * Claim and distribute
     * @param config - The config of the fraction
     * @param mint - The mint of the token
     * @returns The transaction
     */
    async claimAndDistribute(config: PublicKey, mint: PublicKey) {
        return claimAndDistribute(this.program, config, mint, this.connection, this.payer)
    }

    /**
     * Get fractions by participant
     * @param participant - The participant to get the fractions for
     * @returns The fractions
     */
    async getFractionsByParticipant(participant: PublicKey) {
        return getFractionsByParticipant(this.program, participant)
    }

    /**
     * Get fractions by config
     * @param config - The config to get the fractions for
     * @returns The fractions
     */
    async getFractionsByConfig(config: PublicKey) {
        return getFractionsByConfig(this.program, config)
    }

    /**
     * Get the balance of a fraction
     * @param config - The config to get the balance for
     * @returns The balance
     */
    async getFractionBalance(config: PublicKey, mint: PublicKey) {
        return getFractionBalance(this.program, config, mint)
    }

    /**
     * Get a fraction by an authority
     * @param authority - The authority to get the fraction for
     * @returns The fraction
     */
    async getFractionsByAuthority(authority: PublicKey) {
        return getFractionsByAuthority(this.program, authority)
    }
}