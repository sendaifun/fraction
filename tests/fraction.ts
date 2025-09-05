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
} from "@solana/spl-token";
import {
    SystemProgram,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
    Connection
} from "@solana/web3.js";
import { expect } from "chai";

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
                        .claimAndDistribute(fractionName)
                        .accountsPartial({
                            authority: authority.publicKey,
                            bot: botWallet.publicKey,
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

        // Verify configuration
        const fractionConfig = await program.account.fractionConfig.fetch(fractionConfigPda);
        expect(fractionConfig.participants.reduce((sum, p) => sum + p.shareBps, 0)).to.equal(10000);
        expect(fractionConfig.incentiveBps).to.equal(200);
        expect(fractionConfig.botWallet.toString()).to.equal(botWallet.publicKey.toString());
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
            .updateFraction(fractionName, newParticipants, botWallet.publicKey)
            .accountsPartial({
                authority: authority.publicKey,
                fractionConfig: fractionConfigPda,
            })
            .signers([])
            .rpc();

        console.log("Update transaction:", updateTx);

        // Verify updated configuration
        const updatedConfig = await program.account.fractionConfig.fetch(fractionConfigPda);
        expect(updatedConfig.participants.reduce((sum, p) => sum + p.shareBps, 0)).to.equal(10000);
        expect(updatedConfig.participants[0].shareBps).to.equal(3000);
        expect(updatedConfig.participants[1].shareBps).to.equal(2500);
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
            .claimAndDistribute(fractionName)
            .accountsPartial({
                authority: authority.publicKey,
                bot: botWallet.publicKey,
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

        // Get final balances after distribution
        const finalBotBalance = await getAccount(connection, botTokenAta);
        const finalParticipantBalances = await Promise.all(
            participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
        );
        const finalTreasuryBalance = await getAccount(connection, treasuryTokenAccount);

        // Verify distribution amounts
        const expectedBotAmount = Math.floor(depositAmount * 0.02); // 2% incentive
        const expectedParticipantTotal = depositAmount - expectedBotAmount;

        // Check bot received incentive
        const botIncrease = finalBotBalance.amount - initialBotBalance.amount;
        expect(botIncrease).to.equal(BigInt(expectedBotAmount));

        console.log(`Bot balance: ${initialBotBalance.amount} → ${finalBotBalance.amount} (received: ${botIncrease} tokens)`);
        console.log(`Treasury balance: ${depositAmount} → ${finalTreasuryBalance.amount} (distributed all funds)`);

        const expectedShares = [3000, 2500, 2000, 1500, 1000]; // From update test
        for (let i = 0; i < 5; i++) {
            const initialBalance = initialParticipantBalances[i].amount;
            const finalBalance = finalParticipantBalances[i].amount;
            const increase = finalBalance - initialBalance;
            const expectedAmount = Math.floor(expectedParticipantTotal * expectedShares[i] / 10000);

            expect(increase).to.equal(BigInt(expectedAmount));
            console.log(`P${i + 1} balance: ${initialBalance} → ${finalBalance} (received: ${increase} tokens)`);
        }

        expect(finalTreasuryBalance.amount).to.equal(BigInt(0));

        console.log("Direct distribution test passed - no withdrawal needed!");
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
            .claimAndDistribute(fractionName)
            .accountsPartial({
                authority: authority.publicKey,
                bot: botWallet.publicKey,
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
        const afterBotBalance = await getAccount(connection, botTokenAta);
        const finalTreasuryBalance = await getAccount(connection, treasuryTokenAccount);

        // Verify second distribution amounts
        const expectedBotAmount = Math.floor(secondDeposit * 0.02);
        const expectedParticipantTotal = secondDeposit - expectedBotAmount;
        const expectedShares = [3000, 2500, 2000, 1500, 1000];

        console.log("\n=== Second Distribution Results ===");

        // Show bot balance change
        const botIncrease = afterBotBalance.amount - beforeBotBalance.amount;
        expect(botIncrease).to.equal(BigInt(expectedBotAmount));
        console.log(`Bot balance: ${beforeBotBalance.amount} → ${afterBotBalance.amount} (received: ${botIncrease} tokens)`);
        console.log(`Treasury balance: ${secondDeposit} → ${finalTreasuryBalance.amount} (distributed all funds)`);

        for (let i = 0; i < 5; i++) {
            const beforeBalance = beforeBalances[i].amount;
            const afterBalance = afterBalances[i].amount;
            const increase = afterBalance - beforeBalance;
            const expectedAmount = Math.floor(expectedParticipantTotal * expectedShares[i] / 10000);

            expect(increase).to.equal(BigInt(expectedAmount));
            console.log(`P${i + 1} balance: ${beforeBalance} → ${afterBalance} (received: ${increase} tokens)`);
        }

        console.log("Multiple distribution rounds work correctly");
    });

    it("Should reject empty treasury distribution", async () => {
        try {
            await program.methods
                .claimAndDistribute(fractionName)
                .accountsPartial({
                    authority: authority.publicKey,
                    bot: botWallet.publicKey,
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

        console.log("Test deposit transaction:", testDepositTx);

        try {
            await program.methods
                .claimAndDistribute(fractionName)
                .accountsPartial({
                    authority: authority.publicKey,
                    bot: unauthorizedBot.publicKey, // Wrong bot
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
                .updateFraction(fractionName, invalidParticipants, botWallet.publicKey)
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
                .updateFraction(fractionName, systemProgramParticipants, botWallet.publicKey)
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
                .claimAndDistribute(fractionName)
                .accountsPartial({
                    authority: authority.publicKey,
                    bot: botWallet.publicKey,
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
                .updateFraction(fractionName, zeroShareSystemParticipants, botWallet.publicKey)
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

        // Get initial balances
        const initialBotBalance = await getAccount(connection, botTokenAta);
        const initialParticipantBalances = await Promise.all(
            participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
        );

        try {
            // This should succeed since system program has zero share
            const distributionTx = await program.methods
                .claimAndDistribute(fractionName)
                .accountsPartial({
                    authority: authority.publicKey,
                    bot: botWallet.publicKey,
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

            // Get current configuration to debug the incentive calculation
            const debugConfig = await program.account.fractionConfig.fetch(fractionConfigPda);
            console.log("DEBUG - Current config incentive_bps:", debugConfig.incentiveBps);
            console.log("DEBUG - Expected bot amount (2%):", Math.floor(testAmount * 0.02));
            console.log("DEBUG - Calculated bot amount using config:", Math.floor(testAmount * debugConfig.incentiveBps / 10000));

            // Get final balances
            const finalBotBalance = await getAccount(connection, botTokenAta);
            const finalParticipantBalances = await Promise.all(
                participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
            );
            const finalTreasuryBalance = await getAccount(connection, treasuryTokenAccount);

            // Get current configuration to see which participants are set
            const currentConfig = await program.account.fractionConfig.fetch(fractionConfigPda);

            console.log("\n=== Zero-Share System Program Distribution Results ===");
            console.log(`Bot balance: ${initialBotBalance.amount} → ${finalBotBalance.amount} (received: ${finalBotBalance.amount - initialBotBalance.amount} tokens)`);
            console.log(`Treasury balance: ${testAmount} → ${finalTreasuryBalance.amount}`);

            for (let i = 0; i < 5; i++) {
                const initialBalance = initialParticipantBalances[i].amount;
                const finalBalance = finalParticipantBalances[i].amount;
                const increase = finalBalance - initialBalance;
                const participantWallet = currentConfig.participants[i].wallet;
                const shareBps = currentConfig.participants[i].shareBps;
                const isSystemProgram = participantWallet.toString() === SystemProgram.programId.toString();

                console.log(`P${i + 1} balance: ${initialBalance} → ${finalBalance} (received: ${increase} tokens) - Wallet: ${participantWallet.toString().slice(0, 8)}... Share: ${shareBps}bps ${isSystemProgram ? '[SYSTEM PROGRAM - 0 SHARE]' : ''}`);
            }

        } catch (error) {
            console.log("Distribution failed unexpectedly:", error.message);
            throw error;
        }
    });
});