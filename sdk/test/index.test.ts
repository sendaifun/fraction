/// <reference types="jest" />
import { Keypair, PublicKey, Connection, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js"
import { Fraction, createFractionIx } from "../index"

const rpc = "http://127.0.0.1:8899"

describe("Fraction", () => {

    let authority: Keypair

    beforeAll(async () => {
        const connection = new Connection(rpc)
        authority = Keypair.generate()
        const balance = await connection.getBalance(authority.publicKey)
        if (balance < LAMPORTS_PER_SOL) {
            await connection.requestAirdrop(authority.publicKey, LAMPORTS_PER_SOL)
        }
    })

    it("should create a fraction", async () => {
        const connection = new Connection(rpc)

        const fraction = new Fraction(rpc)

        const botWallet = Keypair.generate()

        const tx = await fraction.createFraction({
            authority: authority.publicKey,
            participants: [
                {
                    wallet: authority.publicKey,
                    shareBps: 5000
                },
                {
                    wallet: Keypair.generate().publicKey,
                    shareBps: 5000
                },
                {
                    wallet: SystemProgram.programId,
                    shareBps: 0
                },
                {
                    wallet: SystemProgram.programId,
                    shareBps: 0
                },
                {
                    wallet: SystemProgram.programId,
                    shareBps: 0
                }
            ],
            botWallet: botWallet.publicKey
        })

        if (tx instanceof VersionedTransaction) {
            tx.message.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        } else {
            tx.feePayer = authority.publicKey
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        }

        console.log(Buffer.from(tx.serialize({verifySignatures: false})).toString("base64"))
    })
})