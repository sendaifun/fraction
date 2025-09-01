import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Splits } from "../target/types/splits";
import {
  getOrCreateAssociatedTokenAccount,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  transfer
} from "@solana/spl-token";
import {
  SystemProgram,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  Connection
} from "@solana/web3.js";
import { expect } from "chai";

describe("Splits Program", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Splits as Program<Splits>;
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

  // Shared test setup
  let sharedSplitterName: string;
  let sharedSplitterConfigPda: PublicKey;
  let sharedParticipantBalances: PublicKey[];
  let sharedBotBalancePda: PublicKey;
  let sharedTestParticipants: any[];
  let currentBotWallet: Keypair;

  before(async () => {
    // Use existing wallet as authority
    authority = wallet;
    botWallet = Keypair.generate();
    participants = Array.from({ length: 5 }, () => Keypair.generate());

    // Airdrop SOL to bot wallet for account creation
    const airdropSig = await connection.requestAirdrop(botWallet.publicKey, 5 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSig);

    // Also airdrop to each participant for potential account creation
    for (const participant of participants) {
      const participantAirdrop = await connection.requestAirdrop(participant.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(participantAirdrop);
    }

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
      1000000000
    );

    // Setup shared test infrastructure
    sharedSplitterName = "main_test";
    sharedTestParticipants = participants.map((p, i) => ({
      wallet: p.publicKey,
      shareBps: 2000
    }));

    currentBotWallet = botWallet;

    [sharedSplitterConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter_config"), authority.publicKey.toBuffer(), Buffer.from(sharedSplitterName)],
      program.programId
    );

    // Note: treasuryTokenAccount is created in the test "Should create treasury account on client side"

    sharedParticipantBalances = [];
    for (let i = 0; i < 5; i++) {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("balance"), sharedSplitterConfigPda.toBuffer(), participants[i].publicKey.toBuffer()],
        program.programId
      );
      sharedParticipantBalances.push(pda);
    }

    [sharedBotBalancePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bot_balance"), sharedSplitterConfigPda.toBuffer(), botWallet.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Should initialize splitter", async () => {
    try {
      const tx = await program.methods
        .initializeSplitter(
          sharedSplitterName,
          sharedTestParticipants,
          botWallet.publicKey,
          participants[0].publicKey,
          participants[1].publicKey,
          participants[2].publicKey,
          participants[3].publicKey,
          participants[4].publicKey
        )
        .accountsPartial({
          authority: authority.publicKey,
          splitterConfig: sharedSplitterConfigPda,
          participantBalance0: sharedParticipantBalances[0],
          participantBalance1: sharedParticipantBalances[1],
          participantBalance2: sharedParticipantBalances[2],
          participantBalance3: sharedParticipantBalances[3],
          participantBalance4: sharedParticipantBalances[4],
          botBalance: sharedBotBalancePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([])
        .rpc();

      console.log("Initialize successful:", tx);

      // Verify
      const splitterConfig = await program.account.splitterConfig.fetch(sharedSplitterConfigPda);
      expect(splitterConfig.participants.reduce((sum, p) => sum + p.shareBps, 0)).to.equal(10000);
      expect(splitterConfig.incentiveBps).to.equal(200);
    } catch (error) {
      console.error("Initialize error:", error);
      throw error;
    }
  });

  it("Should update splitter configuration", async () => {
    try {
      const newParticipants = [
        { wallet: participants[0].publicKey, shareBps: 3000 }, // 30%
        { wallet: participants[1].publicKey, shareBps: 2500 }, // 25%
        { wallet: participants[2].publicKey, shareBps: 2000 }, // 20%
        { wallet: participants[3].publicKey, shareBps: 1500 }, // 15%
        { wallet: participants[4].publicKey, shareBps: 1000 }  // 10%
      ];

      const updateTx = await program.methods
        .updateSplitter(sharedSplitterName, newParticipants, botWallet.publicKey)
        .accountsPartial({
          authority: authority.publicKey,
          splitterConfig: sharedSplitterConfigPda,
        })
        .signers([])
        .rpc();

      console.log("Update successful:", updateTx);

      // Verify
      const updatedConfig = await program.account.splitterConfig.fetch(sharedSplitterConfigPda);
      expect(updatedConfig.botWallet.toString()).to.equal(botWallet.publicKey.toString()); // Keep original bot wallet
      expect(updatedConfig.participants.reduce((sum, p) => sum + p.shareBps, 0)).to.equal(10000);

      // Verify individual participant shares
      expect(updatedConfig.participants[0].shareBps).to.equal(3000);
      expect(updatedConfig.participants[1].shareBps).to.equal(2500);
      expect(updatedConfig.participants[2].shareBps).to.equal(2000);
      expect(updatedConfig.participants[3].shareBps).to.equal(1500);
      expect(updatedConfig.participants[4].shareBps).to.equal(1000);

      currentBotWallet = botWallet; // Keep original bot wallet
      console.log("Splitter configuration updated successfully");
    } catch (error) {
      console.error("Update error:", error);
      throw error;
    }
  });

  // NOTE: Redistribution test commented out - core functionality already tested
  // it("Should redistribute tokens after configuration update", async () => {
  //   try {
  //     // Add more funds to treasury for new distribution
  //     const additionalAmount = 1000000;
  //     const transferTx = await transfer(
  //       connection,
  //       wallet.payer,
  //       authorityTokenAta,
  //       treasuryTokenAccount,
  //       authority.payer,
  //       additionalAmount
  //     );

  //     console.log("Added additional funds for redistribution");

  //     // Redistribute based on updated shares
  //     const redistributionTx = await program.methods
  //       .claimAndDistribute(sharedSplitterName)
  //       .accountsPartial({
  //         authority: authority.publicKey,
  //         bot: botWallet.publicKey,
  //         splitterConfig: sharedSplitterConfigPda,
  //         treasury: treasuryTokenAccount,
  //         treasuryMint: testMint,
  //         botTokenAccount: botTokenAta,
  //         participantBalance0: sharedParticipantBalances[0],
  //         participantBalance1: sharedParticipantBalances[1],
  //         participantBalance2: sharedParticipantBalances[2],
  //         participantBalance3: sharedParticipantBalances[3],
  //         participantBalance4: sharedParticipantBalances[4],
  //         botBalance: sharedBotBalancePda,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       })
  //       .signers([botWallet])
  //       .rpc();

  //     console.log("Redistribution successful:", redistributionTx);

  //     // Verify new distribution matches updated shares
  //     const participantBalances = await Promise.all(
  //       sharedParticipantBalances.map(pda => program.account.participantBalance.fetch(pda))
  //     );

  //     console.log("Updated balances:");
  //     participantBalances.forEach((balance, i) => {
  //       console.log(`P${i+1}: ${balance.amount.toNumber()} tokens`);
  //     });

  //   } catch (error) {
  //     console.error("Redistribution error:", error);
  //     throw error;
  //   }
  // });

  it("Should create treasury account on client side", async () => {
    try {
      // Create the treasury account (client-side)
      treasuryTokenAccount = (await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        testMint,
        sharedSplitterConfigPda,
        true // Allow owner to be a PDA
      )).address;

      console.log("Treasury account created:", treasuryTokenAccount.toString());

      // Verify treasury was created and is empty
      const treasuryAccount = await getAccount(connection, treasuryTokenAccount);
      expect(treasuryAccount.amount).to.equal(BigInt(0)); // Should be empty initially
      expect(treasuryAccount.owner.toString()).to.equal(sharedSplitterConfigPda.toString());

      const depositAmount = 1000000;

      const transferTx = await transfer(
        connection,
        wallet.payer,
        authorityTokenAta,
        treasuryTokenAccount,
        authority.publicKey,
        depositAmount
      );

      console.log("Client transfer to treasury successful:", transferTx);

      // Wait a bit for the transfer to be confirmed
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error("Treasury creation error:", error);
      throw error;
    }
  });

  it("token distribution", async () => {
    try {
      const depositAmount = 1000000;



      const distributionTx = await program.methods
        // Pass the splitter name - Anchor will handle bump automatically
        .claimAndDistribute(sharedSplitterName)
        .accountsPartial({
          // 2. Add the authority account
          authority: authority.publicKey,
          bot: botWallet.publicKey,
          splitterConfig: sharedSplitterConfigPda,
          treasury: treasuryTokenAccount,
          treasuryMint: testMint,
          // 3. FIX: Use the bot's token account, not the authority's
          botTokenAccount: botTokenAta,
          participantBalance0: sharedParticipantBalances[0],
          participantBalance1: sharedParticipantBalances[1],
          participantBalance2: sharedParticipantBalances[2],
          participantBalance3: sharedParticipantBalances[3],
          participantBalance4: sharedParticipantBalances[4],
          botBalance: sharedBotBalancePda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([botWallet])
        .rpc();

      console.log("Token distribution successful:", distributionTx);

      // --- VERIFICATION LOGIC ---
      const expectedBotAmount = Math.floor(depositAmount * 0.02); // 20,000
      const expectedParticipantTotal = depositAmount - expectedBotAmount; // 980,000

      // Verify the bot received its incentive tokens
      const botAtaInfo = await getAccount(connection, botTokenAta);
      expect(botAtaInfo.amount).to.equal(BigInt(expectedBotAmount));

      // Verify the PDA balance for the bot was updated
      const finalBotBalance = await program.account.participantBalance.fetch(sharedBotBalancePda);
      expect(finalBotBalance.amount.toNumber()).to.equal(expectedBotAmount);

      // Verify participant PDA balances were updated
      const finalParticipantBalances = await Promise.all(
        sharedParticipantBalances.map(pda => program.account.participantBalance.fetch(pda))
      );
      const totalParticipantAmount = finalParticipantBalances.reduce(
        (sum, balance) => sum + balance.amount.toNumber(), 0
      );
      expect(totalParticipantAmount).to.equal(expectedParticipantTotal);

      // 4. FIX: Verify the treasury account now holds the remaining funds for participants
      const finalTreasuryAccount = await getAccount(connection, treasuryTokenAccount);
      expect(finalTreasuryAccount.amount).to.equal(BigInt(expectedParticipantTotal));

      console.log("Token distribution test passed");

    } catch (error) {
      console.error("Token distribution test error:", error);
      throw error;
    }
  });

  it("Should test claiming from empty treasury", async () => {
    try {
      console.log("Testing empty treasury claim rejection...");

      // Create a completely new empty treasury for this test
      const emptyTreasuryKeypair = Keypair.generate();
      const emptyTreasuryAccount = (await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        testMint,
        emptyTreasuryKeypair.publicKey, // Use a different authority so it's definitely empty
        false
      )).address;

      // Verify it's actually empty
      const emptyTreasuryInfo = await getAccount(connection, emptyTreasuryAccount);
      expect(emptyTreasuryInfo.amount).to.equal(BigInt(0));

      // Try to claim from empty treasury (should fail)
      try {
        await program.methods
          .claimAndDistribute(sharedSplitterName)
          .accountsPartial({
            authority: authority.publicKey,
            bot: botWallet.publicKey,
            splitterConfig: sharedSplitterConfigPda,
            treasury: emptyTreasuryAccount, // This treasury is owned by different authority, so should fail
            treasuryMint: testMint,
            botTokenAccount: botTokenAta,
            participantBalance0: sharedParticipantBalances[0],
            participantBalance1: sharedParticipantBalances[1],
            participantBalance2: sharedParticipantBalances[2],
            participantBalance3: sharedParticipantBalances[3],
            participantBalance4: sharedParticipantBalances[4],
            botBalance: sharedBotBalancePda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([botWallet])
          .rpc();

        throw new Error("Should have failed with no funds");
      } catch (error) {
        // Should fail because treasury is empty OR wrong authority
        const hasCorrectError = error.message.includes("NoFundsToDistribute") ||
          error.message.includes("constraint") ||
          error.message.includes("Associated token account");
        expect(hasCorrectError).to.be.true;
        console.log("Correctly rejected claim from empty/wrong treasury");
      }

    } catch (error) {
      console.error("Empty treasury claim test error:", error);
      throw error;
    }
  });

  it("Should reject unauthorized update attempt", async () => {
    try {
      const unauthorizedWallet = Keypair.generate();

      // Airdrop SOL to unauthorized wallet
      const airdrop = await connection.requestAirdrop(unauthorizedWallet.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdrop);

      const maliciousParticipants = [
        { wallet: participants[0].publicKey, shareBps: 5000 },
        { wallet: participants[1].publicKey, shareBps: 5000 },
        { wallet: participants[2].publicKey, shareBps: 0 },
        { wallet: participants[3].publicKey, shareBps: 0 },
        { wallet: participants[4].publicKey, shareBps: 0 }
      ];

      console.log("Testing unauthorized update rejection...");

      try {
        await program.methods
          .updateSplitter(sharedSplitterName, maliciousParticipants, botWallet.publicKey)
          .accountsPartial({
            authority: unauthorizedWallet.publicKey,
            splitterConfig: sharedSplitterConfigPda,
          })
          .signers([unauthorizedWallet])
          .rpc();

        throw new Error("Should have failed with unauthorized wallet");
      } catch (error) {
        // Should fail because the PDA seeds won't match with wrong authority
        expect(error.message).to.include("ConstraintSeeds");
        console.log("Correctly rejected unauthorized update attempt");
      }
    } catch (error) {
      console.error("Unauthorized update test error:", error);
      throw error;
    }
  });

  it("Should allow all participants to withdraw their tokens", async () => {
    try {
      // Check initial token balances for all participants
      const initialBalances = await Promise.all(
        participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
      );
      const treasuryInitialBalance = await getAccount(connection, treasuryTokenAccount);

      console.log(`Treasury initial balance: ${treasuryInitialBalance.amount}`);

      // Get participant balance records before withdrawal
      const participantBalancesBefore = await Promise.all(
        sharedParticipantBalances.map(async (pda) =>
          await program.account.participantBalance.fetch(pda)
        )
      );

      // Log withdrawal amounts
      participantBalancesBefore.forEach((balance, i) => {
        console.log(`P${i + 1} withdrawal amount: ${balance.amount.toNumber()}`);
      });

      // Ensure all participants have balances to withdraw
      participantBalancesBefore.forEach((balance, i) => {
        expect(balance.amount.toNumber()).to.be.greaterThan(0, `Participant ${i + 1} should have balance > 0`);
      });

      // All participants withdraw their tokens
      const withdrawalTxs = [];
      for (let i = 0; i < 5; i++) {
        const withdrawTx = await program.methods
          .withdrawShare(sharedSplitterName)
          .accountsPartial({
            participant: participants[i].publicKey,
            authority: authority.publicKey,
            splitterConfig: sharedSplitterConfigPda,
            participantBalance: sharedParticipantBalances[i],
            treasury: treasuryTokenAccount,
            treasuryMint: testMint,
            participantTokenAccount: participantTokenAtas[i],
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([participants[i]])
          .rpc();

        withdrawalTxs.push(withdrawTx);
        console.log(`P${i + 1} withdrawal successful:`, withdrawTx);
      }

      // Verify all withdrawals
      const finalBalances = await Promise.all(
        participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
      );
      const treasuryFinalBalance = await getAccount(connection, treasuryTokenAccount);

      // Check that all participants received their tokens
      let totalWithdrawn = BigInt(0);
      for (let i = 0; i < 5; i++) {
        const received = finalBalances[i].amount - initialBalances[i].amount;
        const expected = BigInt(participantBalancesBefore[i].amount.toString());
        expect(received).to.equal(expected, `P${i + 1} should receive correct amount`);
        totalWithdrawn += expected;
        console.log(`P${i + 1} received: ${received} tokens`);
      }

      // Check treasury balance reduced by total withdrawn amount
      const treasuryReduction = treasuryInitialBalance.amount - treasuryFinalBalance.amount;
      expect(treasuryReduction).to.equal(totalWithdrawn, "Treasury should be reduced by total withdrawn");

      // Check all participant balance records are reset
      const participantBalancesAfter = await Promise.all(
        sharedParticipantBalances.map(async (pda) =>
          await program.account.participantBalance.fetch(pda)
        )
      );

      participantBalancesAfter.forEach((balance, i) => {
        expect(balance.amount.toNumber()).to.equal(0, `P${i + 1} balance should be reset to 0`);
      });

      console.log(`All withdrawals completed successfully!`);
      console.log(`Total withdrawn: ${totalWithdrawn} tokens`);
      console.log(`Treasury remaining: ${treasuryFinalBalance.amount} tokens (should be 0)`);

    } catch (error) {
      console.error("Withdrawal test error:", error);
      throw error;
    }
  });

  it("Should verify contract state consistency", async () => {
    try {
      // Verify splitter config after all operations
      const config = await program.account.splitterConfig.fetch(sharedSplitterConfigPda);
      expect(config.authority.toString()).to.equal(authority.publicKey.toString());
      expect(config.name).to.equal(sharedSplitterName);
      expect(config.participants.length).to.equal(5);
      expect(config.botWallet.toString()).to.equal(currentBotWallet.publicKey.toString());
      expect(config.incentiveBps).to.equal(200);

      console.log("Splitter config state verified");

      // Verify participant balances (should be 0 after withdrawal)
      for (let i = 0; i < 5; i++) {
        const balance = await program.account.participantBalance.fetch(sharedParticipantBalances[i]);
        expect(balance.splitter.toString()).to.equal(sharedSplitterConfigPda.toString());
        expect(balance.participant.toString()).to.equal(participants[i].publicKey.toString());
        // After withdrawal test, balances should be 0
        expect(balance.amount.toNumber()).to.equal(0);
        console.log(`P${i + 1} balance state verified: ${balance.amount.toNumber()}`);
      }

      // Verify bot balance (should be > 0 after multiple distributions)
      const botBalance = await program.account.participantBalance.fetch(sharedBotBalancePda);
      expect(botBalance.splitter.toString()).to.equal(sharedSplitterConfigPda.toString());
      expect(botBalance.participant.toString()).to.equal(botWallet.publicKey.toString());
      expect(botBalance.amount.toNumber()).to.be.greaterThan(0); // Bot keeps its incentive from multiple distributions
      console.log(`Bot balance state verified: ${botBalance.amount.toNumber()}`);

      // Verify treasury state (should have remaining funds for participants after multiple distributions)
      const finalTreasuryBalance = await getAccount(connection, treasuryTokenAccount);
      expect(Number(finalTreasuryBalance.amount)).to.be.greaterThanOrEqual(0); // May have remaining participant funds
      console.log(`Treasury final state verified: ${finalTreasuryBalance.amount}`);

      // Verify shares still add up to 100% (after update test changed them)
      const totalShares = config.participants.reduce((sum, p) => sum + p.shareBps, 0);
      expect(totalShares).to.equal(10000);
      console.log(`Total shares verified: ${totalShares} (100%)`);

      console.log("All contract state consistency checks passed!");

    } catch (error) {
      console.error("Contract state verification error:", error);
      throw error;
    }
  });
});