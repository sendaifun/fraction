/// <reference types="jest" />
import { Keypair, PublicKey, Connection, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js"
import { Fraction, createFractionIx } from "../index"
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token"

// const rpc = "http://127.0.0.1:8899"
const rpc = "https://api.devnet.solana.com"

describe("Fraction", () => {

    let authority: Keypair
    let fractionConfigPda: PublicKey
    let mint: PublicKey
    let botWallet: Keypair
    let participant_a: Keypair

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

        botWallet = Keypair.generate()
        participant_a = Keypair.generate()

        const { tx, fractionConfigPda: newFractionConfigPda } = await fraction.createFraction({
            authority: authority.publicKey,
            participants: [
                {
                    wallet: authority.publicKey,
                    shareBps: 5000
                },
                {
                    wallet: participant_a.publicKey,
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

        fractionConfigPda = newFractionConfigPda

        if (tx instanceof VersionedTransaction) {
            tx.message.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        } else {
            tx.feePayer = authority.publicKey
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        }

        console.log(Buffer.from(tx.serialize({ verifySignatures: false })).toString("base64"))

        await new Promise(resolve => setTimeout(resolve, 1000));

        const signature = await connection.sendTransaction(tx as Transaction, [authority], {
            skipPreflight: true
        })
        console.log(signature)
    })

    it("should send tokens to the fraction", async () => {
        const connection = new Connection(rpc)

        mint = await createMint(connection, authority, authority.publicKey, authority.publicKey, 6, undefined, {
            skipPreflight: true
        })

        console.log("mint", mint)

        const treasury = await getOrCreateAssociatedTokenAccount(connection, authority, mint, fractionConfigPda, true, "confirmed", {
            skipPreflight: true
        })

        console.log("treasury.address", treasury.address)

        const signature = await mintTo(connection, authority, mint, treasury.address, authority, 10000000000, undefined, {
            skipPreflight: true
        })

        console.log(signature)
    }, 80000)

    it("should claim and distribute tokens", async () => {
        const connection = new Connection(rpc)

        const fraction = new Fraction(rpc)

        await getOrCreateAssociatedTokenAccount(connection, authority, mint, botWallet.publicKey, true, "confirmed", {
            skipPreflight: true
        })
        await getOrCreateAssociatedTokenAccount(connection, authority, mint, authority.publicKey, true, "confirmed", {
            skipPreflight: true
        })
        await getOrCreateAssociatedTokenAccount(connection, authority, mint, participant_a.publicKey, true, "confirmed", {
            skipPreflight: true
        })
        await getOrCreateAssociatedTokenAccount(connection, authority, mint, SystemProgram.programId, true, "confirmed", {
            skipPreflight: true
        })

        const tx = await fraction.claimAndDistribute(fractionConfigPda, mint)

        if (tx instanceof VersionedTransaction) {
            tx.message.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        } else {
            tx.feePayer = authority.publicKey
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        }

        console.log(Buffer.from(tx.serialize({ verifySignatures: false })).toString("base64"))

        await new Promise(resolve => setTimeout(resolve, 1000));

        const signature = await connection.sendTransaction(tx as Transaction, [botWallet, authority], {
            skipPreflight: true
        })
        console.log(signature)
    }, 80000)
})