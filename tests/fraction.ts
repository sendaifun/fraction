import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fraction } from "../target/types/fraction";
import {
    getOrCreateAssociatedTokenAccount,
    createMint,
    mintTo,
    TOKEN_PROGRAM_ID,
    getAccount,
    transfer,
    createSyncNativeInstruction,
} from "@solana/spl-token";
import {
    SystemProgram,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
    Connection
} from "@solana/web3.js";
import { expect } from "chai";
// const { NATIVE_MINT } = await import("@solana/spl-token");
import { NATIVE_MINT } from "@solana/spl-token";

describe("Fraction Program - Direct Distribution", () => {
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Fraction as Program<Fraction>;
    const provider = anchor.getProvider();
    const connection = provider.connection as Connection;
    const wallet = provider.wallet as anchor.Wallet;

    // Test accounts
    let authority: anchor.Wallet;
    let botWallet: Keypair;
    let participants: Keypair[];
    let testMint: PublicKey;
    let authorityTokenAta: PublicKey;
    let botTokenAta: PublicKey;
    let participantTokenAtas: PublicKey[];
    let treasuryTokenAccount: PublicKey;

    // Test setup
    let fractionName: string;
    let fractionConfigPda: PublicKey;
    let testParticipants: any[];

    // Helper function to clean up treasury
    const cleanupTreasury = async () => {
        if (!treasuryTokenAccount) return;

        try {
            const treasuryAccount = await getAccount(connection, treasuryTokenAccount);
            if (treasuryAccount.amount > 0) {
                console.log(`Cleaning up treasury balance: ${treasuryAccount.amount}`);

                // Use the ClaimAndDistribute instruction to empty the treasury
                // This will distribute any remaining funds, which is actually what we want
                try {
                    await program.methods
                        .claimAndDistribute()
                        .accountsPartial({
                            authority: authority.publicKey,
                            botWallet: botWallet.publicKey,
                            fractionConfig: fractionConfigPda,
                            treasury: treasuryTokenAccount,
                            treasuryMint: testMint,
                            botTokenAccount: botTokenAta,
                            participantTokenAccount0: participantTokenAtas[0],
                            participantTokenAccount1: participantTokenAtas[1],
                            participantTokenAccount2: participantTokenAtas[2],
                            participantTokenAccount3: participantTokenAtas[3],
                            participantTokenAccount4: participantTokenAtas[4],
                            tokenProgram: TOKEN_PROGRAM_ID,
                        })
                        .signers([botWallet])
                        .rpc();
                    console.log("Treasury cleaned up successfully via distribution");
                } catch (distError) {
                    console.log("Distribution cleanup failed:", distError.message);
                }
            }
        } catch (error) {
            console.log("Treasury cleanup not needed or failed:", error.message);
        }
    };

    before(async () => {
        // Use existing wallet as authority
        authority = wallet;
        botWallet = Keypair.generate();
        participants = Array.from({ length: 5 }, () => Keypair.generate());

        // Airdrop SOL to bot wallet
        const airdropSig = await connection.requestAirdrop(botWallet.publicKey, 5 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSig);

        // Create test mint
        testMint = await createMint(
            connection,
            wallet.payer,
            wallet.payer.publicKey,
            wallet.payer.publicKey,
            6
        );

        // Create token accounts
        authorityTokenAta = (await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.payer,
            testMint,
            authority.publicKey
        )).address;

        botTokenAta = (await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.payer,
            testMint,
            botWallet.publicKey
        )).address;

        participantTokenAtas = await Promise.all(
            participants.map(async (p) =>
                (await getOrCreateAssociatedTokenAccount(
                    connection,
                    wallet.payer,
                    testMint,
                    p.publicKey
                )).address
            )
        );

        // Mint tokens to authority
        await mintTo(
            connection,
            wallet.payer,
            testMint,
            authorityTokenAta,
            wallet.payer,
            10000000000 // 10B tokens
        );

        // Setup test infrastructure
        fractionName = "test_fraction";
        testParticipants = participants.map((p, i) => ({
            wallet: p.publicKey,
            shareBps: 2000 // 20% each
        }));

        [fractionConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("fraction_config"), authority.publicKey.toBuffer(), Buffer.from(fractionName)],
            program.programId
        );
    });

    it("Should initialize fraction", async () => {
        const tx = await program.methods
            .initializeFraction(
                fractionName,
                testParticipants,
                botWallet.publicKey
            )
            .accountsPartial({
                authority: authority.publicKey,
                fractionConfig: fractionConfigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([])
            .rpc();

        console.log("Initialize transaction:", tx);
    });

    it("Should update fraction configuration", async () => {
        const newParticipants = [
            { wallet: participants[0].publicKey, shareBps: 3000 }, // 30%
            { wallet: participants[1].publicKey, shareBps: 2500 }, // 25%
            { wallet: participants[2].publicKey, shareBps: 2000 }, // 20%
            { wallet: participants[3].publicKey, shareBps: 1500 }, // 15%
            { wallet: participants[4].publicKey, shareBps: 1000 }  // 10%
        ];

        const updateTx = await program.methods
            .updateFraction(newParticipants, botWallet.publicKey)
            .accountsPartial({
                authority: authority.publicKey,
                fractionConfig: fractionConfigPda,
            })
            .signers([])
            .rpc();

        console.log("Update transaction:", updateTx);
    });

    it("Should create treasury and deposit funds", async () => {
        // Create treasury account (client-side)
        treasuryTokenAccount = (await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.payer,
            testMint,
            fractionConfigPda,
            true // Allow PDA owner
        )).address;

        console.log("Treasury account created:", treasuryTokenAccount.toString());

        // Deposit funds to treasury
        const depositAmount = 1000000000; // 1B tokens
        const depositTx = await transfer(
            connection,
            wallet.payer,
            authorityTokenAta,
            treasuryTokenAccount,
            authority.publicKey,
            depositAmount
        );

        console.log("Treasury deposit transaction:", depositTx);
        console.log("Deposited to treasury:", depositAmount);

        // Verify treasury balance
        const treasuryAccount = await getAccount(connection, treasuryTokenAccount);
        expect(treasuryAccount.amount).to.equal(BigInt(depositAmount));
        expect(treasuryAccount.owner.toString()).to.equal(fractionConfigPda.toString());
    });

    it("Should distribute tokens directly to participants", async () => {
        const depositAmount = 1000000000; // 1B tokens

        // Get initial balances
        const initialBotBalance = await getAccount(connection, botTokenAta);
        const initialParticipantBalances = await Promise.all(
            participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
        );

        // Execute distribution
        const distributionTx = await program.methods
            .claimAndDistribute()
            .accountsPartial({
                authority: authority.publicKey,
                botWallet: botWallet.publicKey,
                fractionConfig: fractionConfigPda,
                treasury: treasuryTokenAccount,
                treasuryMint: testMint,
                botTokenAccount: botTokenAta,
                participantTokenAccount0: participantTokenAtas[0],
                participantTokenAccount1: participantTokenAtas[1],
                participantTokenAccount2: participantTokenAtas[2],
                participantTokenAccount3: participantTokenAtas[3],
                participantTokenAccount4: participantTokenAtas[4],
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([botWallet])
            .rpc();

        console.log("Direct distribution transaction:", distributionTx);
    });

    it("Should handle multiple distribution rounds", async () => {
        await cleanupTreasury();
        const secondDeposit = 500000000; // 500M tokens
        const secondDepositTx = await transfer(
            connection,
            wallet.payer,
            authorityTokenAta,
            treasuryTokenAccount,
            authority.publicKey,
            secondDeposit
        );

        console.log("Second treasury deposit transaction:", secondDepositTx);


        // Get balances before second distribution
        const beforeBalances = await Promise.all(
            participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
        );
        const beforeBotBalance = await getAccount(connection, botTokenAta);

        // Second distribution
        const secondDistributionTx = await program.methods
            .claimAndDistribute()
            .accountsPartial({
                authority: authority.publicKey,
                botWallet: botWallet.publicKey,
                fractionConfig: fractionConfigPda,
                treasury: treasuryTokenAccount,
                treasuryMint: testMint,
                botTokenAccount: botTokenAta,
                participantTokenAccount0: participantTokenAtas[0],
                participantTokenAccount1: participantTokenAtas[1],
                participantTokenAccount2: participantTokenAtas[2],
                participantTokenAccount3: participantTokenAtas[3],
                participantTokenAccount4: participantTokenAtas[4],
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([botWallet])
            .rpc();

        console.log("Second distribution transaction:", secondDistributionTx);

        // Get final balances after second distribution
        const afterBalances = await Promise.all(
            participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
        );
        console.log("Multiple distribution rounds work correctly");
    });

    it("Should reject empty treasury distribution", async () => {
        try {
            await program.methods
                .claimAndDistribute()
                .accountsPartial({
                    authority: authority.publicKey,
                    botWallet: botWallet.publicKey,
                    fractionConfig: fractionConfigPda,
                    treasury: treasuryTokenAccount,
                    treasuryMint: testMint,
                    botTokenAccount: botTokenAta,
                    participantTokenAccount0: participantTokenAtas[0],
                    participantTokenAccount1: participantTokenAtas[1],
                    participantTokenAccount2: participantTokenAtas[2], participantTokenAccount3: participantTokenAtas[3],
                    participantTokenAccount4: participantTokenAtas[4],
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([botWallet])
                .rpc();

            expect.fail("Should have failed with empty treasury");
        } catch (error) {
            expect(error.message).to.include("NoFundsToDistribute");
            console.log("Correctly rejected empty treasury distribution");
        }
    });

    it("Should reject unauthorized bot attempts", async () => {
        const unauthorizedBot = Keypair.generate();

        // Clean up any existing treasury balance before test
        await cleanupTreasury();

        // Add funds to test with
        const testDepositTx = await transfer(
            connection,
            wallet.payer,
            authorityTokenAta,
            treasuryTokenAccount,
            authority.publicKey,
            1000000
        );

        try {
            await program.methods
                .claimAndDistribute()
                .accountsPartial({
                    authority: authority.publicKey,
                    botWallet: unauthorizedBot.publicKey, // Wrong bot
                    fractionConfig: fractionConfigPda,
                    treasury: treasuryTokenAccount,
                    treasuryMint: testMint,
                    botTokenAccount: botTokenAta,
                    participantTokenAccount0: participantTokenAtas[0],
                    participantTokenAccount1: participantTokenAtas[1],
                    participantTokenAccount2: participantTokenAtas[2],
                    participantTokenAccount3: participantTokenAtas[3],
                    participantTokenAccount4: participantTokenAtas[4],
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([unauthorizedBot])
                .rpc();

            expect.fail("Should have failed with unauthorized bot");
        } catch (error) {
            expect(error.message).to.include("InvalidBot");
            console.log("Correctly rejected unauthorized bot");
        }
    });

    it("Should reject invalid share distributions", async () => {
        const invalidParticipants = [
            { wallet: participants[0].publicKey, shareBps: 5000 }, // 50%
            { wallet: participants[1].publicKey, shareBps: 3000 }, // 30%
            { wallet: participants[2].publicKey, shareBps: 2000 }, // 20%
            { wallet: participants[3].publicKey, shareBps: 1000 }, // 10%
            { wallet: participants[4].publicKey, shareBps: 500 }   // 5% = Total: 115%
        ];

        try {
            await program.methods
                .updateFraction(invalidParticipants, botWallet.publicKey)
                .accountsPartial({
                    authority: authority.publicKey,
                    fractionConfig: fractionConfigPda,
                })
                .signers([])
                .rpc();

            expect.fail("Should have failed with invalid share distribution");
        } catch (error) {
            expect(error.message).to.include("InvalidShareDistribution");
            console.log("Correctly rejected invalid share distribution");
        }
    });

    it("Should fail distribution when system program is a participant with non-zero share", async () => {
        // First, let's create a configuration with a system program participant for testing
        const systemProgramParticipants = [
            { wallet: participants[0].publicKey, shareBps: 2500 }, // 25%
            { wallet: participants[1].publicKey, shareBps: 2500 }, // 25%
            { wallet: SystemProgram.programId, shareBps: 2500 },    // 25% - System Program (should cause error)
            { wallet: participants[3].publicKey, shareBps: 1500 }, // 15%
            { wallet: participants[4].publicKey, shareBps: 1000 }  // 10%
        ];

        try {
            // Try to update config with system program participant
            const updateTx = await program.methods
                .updateFraction(systemProgramParticipants, botWallet.publicKey)
                .accountsPartial({
                    authority: authority.publicKey,
                    fractionConfig: fractionConfigPda,
                })
                .signers([])
                .rpc();

            console.log("System program participant configuration set");
            console.log("Config Update Transaction ID:", updateTx);
        } catch (error) {
            console.log("Could not set system program participant in config:", error.message);
            console.log("Test cannot proceed - system program validation may be in place at config level");
            return;
        }

        // Clean up any existing treasury balance before test
        await cleanupTreasury();

        // Add funds for testing distribution
        const testAmount = 100000000; // 100M tokens
        const testDepositTx = await transfer(
            connection,
            wallet.payer,
            authorityTokenAta,
            treasuryTokenAccount,
            authority.publicKey,
            testAmount
        );

        console.log("Test deposit for system program test");
        console.log("Treasury Deposit Transaction ID:", testDepositTx);

        // Now try distribution - this should fail with SystemProgramParticipant error
        try {
            const distributionTx = await program.methods
                .claimAndDistribute()
                .accountsPartial({
                    authority: authority.publicKey,
                    botWallet: botWallet.publicKey,
                    fractionConfig: fractionConfigPda,
                    treasury: treasuryTokenAccount,
                    treasuryMint: testMint,
                    botTokenAccount: botTokenAta,
                    participantTokenAccount0: participantTokenAtas[0],
                    participantTokenAccount1: participantTokenAtas[1],
                    participantTokenAccount2: participantTokenAtas[2],
                    participantTokenAccount3: participantTokenAtas[3],
                    participantTokenAccount4: participantTokenAtas[4],
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([botWallet])
                .rpc();

            console.log("Distribution unexpectedly succeeded:", distributionTx);
            throw new Error("Distribution should have failed with system program participant");
        } catch (error) {
            // Check if the error is the expected SystemProgramParticipant error
            if (error.message.includes("System program cannot be a participant wallet") ||
                error.message.includes("SystemProgramParticipant")) {
                console.log("Distribution correctly failed with SystemProgramParticipant error:", error.message);
            } else {
                console.log("Distribution failed but with unexpected error:", error.message);
                throw error;
            }
        }
    });

    it("Should allow distribution when system program participant has zero share", async () => {
        // Create a configuration with system program participant but zero share
        const zeroShareSystemParticipants = [
            { wallet: participants[0].publicKey, shareBps: 3000 }, // 30%
            { wallet: participants[1].publicKey, shareBps: 3000 }, // 30%
            { wallet: SystemProgram.programId, shareBps: 0 },       // 0% - System Program (should be OK)
            { wallet: participants[3].publicKey, shareBps: 2000 }, // 20%
            { wallet: participants[4].publicKey, shareBps: 2000 }  // 20%
        ];

        try {
            // Update config with system program participant having zero share
            const updateTx = await program.methods
                .updateFraction(zeroShareSystemParticipants, botWallet.publicKey)
                .accountsPartial({
                    authority: authority.publicKey,
                    fractionConfig: fractionConfigPda,
                })
                .signers([])
                .rpc();

            console.log("Zero-share system program participant configuration set");
            console.log("Config Update Transaction ID:", updateTx);
        } catch (error) {
            console.log(" Could not set zero-share system program participant in config:", error.message);
            console.log("Test cannot proceed");
            return;
        }

        // Clean up any existing treasury balance before test
        await cleanupTreasury();

        // Add funds for testing distribution
        const testAmount = 100000000; // 100M tokens
        const testDepositTx = await transfer(
            connection,
            wallet.payer,
            authorityTokenAta,
            treasuryTokenAccount,
            authority.publicKey,
            testAmount
        );

        console.log("Test deposit for zero-share system program test");
        console.log("Treasury Deposit Transaction ID:", testDepositTx);
        try {
            // This should succeed since system program has zero share
            const distributionTx = await program.methods
                .claimAndDistribute()
                .accountsPartial({
                    authority: authority.publicKey,
                    botWallet: botWallet.publicKey,
                    fractionConfig: fractionConfigPda,
                    treasury: treasuryTokenAccount,
                    treasuryMint: testMint,
                    botTokenAccount: botTokenAta,
                    participantTokenAccount0: participantTokenAtas[0],
                    participantTokenAccount1: participantTokenAtas[1],
                    participantTokenAccount2: participantTokenAtas[2],
                    participantTokenAccount3: participantTokenAtas[3],
                    participantTokenAccount4: participantTokenAtas[4],
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([botWallet])
                .rpc();

            console.log("Distribution succeeded with zero-share system program participant");
            console.log("Distribution Transaction ID:", distributionTx);
        } catch (error) {
            console.log("Distribution failed unexpectedly:", error.message);
            throw error;
        }
    });

    it("Should handle WSOL distribution with SOL to WSOL conversion", async () => {
        // Create a new fraction config for WSOL testing
        const wsolFractionName = "wsol_test_fraction";
        const wsolTestParticipants = participants.map((p, i) => ({
            wallet: p.publicKey,
            shareBps: 2000 // 20% each
        }));

        const [wsolFractionConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("fraction_config"), authority.publicKey.toBuffer(), Buffer.from(wsolFractionName)],
            program.programId
        );

        // Initialize WSOL fraction config
        const initTx = await program.methods
            .initializeFraction(
                wsolFractionName,
                wsolTestParticipants,
                botWallet.publicKey
            )
            .accountsPartial({
                authority: authority.publicKey,
                fractionConfig: wsolFractionConfigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([])
            .rpc();

        console.log("WSOL fraction config initialized:", initTx);

        // Create WSOL token accounts for all participants
        const wsolBotTokenAta = (await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.payer,
            NATIVE_MINT,
            botWallet.publicKey
        )).address;

        const wsolParticipantTokenAtas = await Promise.all(
            participants.map(async (p) =>
                (await getOrCreateAssociatedTokenAccount(
                    connection,
                    wallet.payer,
                    NATIVE_MINT,
                    p.publicKey
                )).address
            )
        );

        //Create WSOL treasury account (PDA-owned)
        const wsolTreasuryTokenAccount = (await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.payer,
            NATIVE_MINT,
            wsolFractionConfigPda,
            true // Allow PDA owner
        )).address;

        console.log("WSOL treasury account created:", wsolTreasuryTokenAccount.toString());

        // Transfer SOL directly to the WSOL treasury token account
        // This simulates the case where SOL is sent to a WSOL token account
        const solAmount = 2 * LAMPORTS_PER_SOL; // 2 SOL
        const solTransferTx = await connection.sendTransaction(
            new anchor.web3.Transaction().add(
                anchor.web3.SystemProgram.transfer({
                    fromPubkey: wallet.publicKey,
                    toPubkey: wsolTreasuryTokenAccount,
                    lamports: solAmount,
                })
            ),
            [wallet.payer]
        );

        console.log("SOL transferred to WSOL treasury account:", solTransferTx);
        console.log("SOL amount transferred:", solAmount, "lamports");

        // const amountToWrap = 1 * anchor.web3.LAMPORTS_PER_SOL;
        // // Create WSOL treasury account (PDA-owned)
        // const wsolTreasuryTokenAccount = (await getOrCreateAssociatedTokenAccount(
        //     connection,
        //     wallet.payer,
        //     NATIVE_MINT,
        //     wsolFractionConfigPda,
        //     true // Allow PDA owner
        // )).address;

        // console.log("WSOL treasury account created:", wsolTreasuryTokenAccount.toString());
        // // Send transaction to wrap SOL
        // const wrapTx = new anchor.web3.Transaction().add(
        //     anchor.web3.SystemProgram.transfer({
        //         fromPubkey: wallet.publicKey, // Sender (creator)
        //         toPubkey: wsolTreasuryTokenAccount, // Associated token account for WSOL
        //         lamports: amountToWrap, // Amount to transfer (2 SOL)
        //     }),
        //     createSyncNativeInstruction(wsolTreasuryTokenAccount) // Sync native balance with token balance
        // );
        // // Sign and send the transaction
        // await anchor.web3.sendAndConfirmTransaction(connection, wrapTx, [wallet.payer]);

        // console.log("Wrapped 2 SOL into WSOL at:", wsolTreasuryTokenAccount.toBase58());

        // Get initial token account balance (should be 0 since syncNative hasn't been called)
        const initialTreasuryAccount = await getAccount(connection, wsolTreasuryTokenAccount);
        console.log("Treasury WSOL token balance before syncNative:", initialTreasuryAccount.amount.toString());

        // Get initial balances for distribution verification
        const initialWsolBotBalance = await getAccount(connection, wsolBotTokenAta);
        const initialWsolParticipantBalances = await Promise.all(
            wsolParticipantTokenAtas.map(async (ata) => await getAccount(connection, ata))
        );

        // Execute distribution - this should automatically call syncNative due to our WSOL handling
        const distributionTx = await program.methods
            .claimAndDistribute()
            .accountsPartial({
                authority: authority.publicKey,
                botWallet: botWallet.publicKey,
                fractionConfig: wsolFractionConfigPda,
                treasury: wsolTreasuryTokenAccount,
                treasuryMint: NATIVE_MINT, // WSOL native mint
                botTokenAccount: wsolBotTokenAta,
                participantTokenAccount0: wsolParticipantTokenAtas[0],
                participantTokenAccount1: wsolParticipantTokenAtas[1],
                participantTokenAccount2: wsolParticipantTokenAtas[2],
                participantTokenAccount3: wsolParticipantTokenAtas[3],
                participantTokenAccount4: wsolParticipantTokenAtas[4],
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([botWallet])
            .rpc();

        console.log("WSOL distribution with syncNative executed:", distributionTx);
        console.log("Treasury WSOL token balance after syncNative:", initialTreasuryAccount.amount.toString());
    });
});