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

  // Shared test setup
  let sharedSplitterName: string;
  let sharedSplitterConfigPda: PublicKey;
  let sharedTreasuryPda: PublicKey;
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

    // Use new 3-seed PDA pattern
    [sharedSplitterConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("splitter_config"), authority.publicKey.toBuffer(), Buffer.from(sharedSplitterName)],
      program.programId
    );

    sharedTreasuryPda = await getAssociatedTokenAddress(
      testMint,
      sharedSplitterConfigPda,
      true
    );

    sharedParticipantBalances = [];
    for (let i = 0; i < 5; i++) {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("balance"), sharedSplitterConfigPda.toBuffer(), participants[i].publicKey.toBuffer()],
        program.programId
      );
      sharedParticipantBalances.push(pda);
    }

    // Use new 3-seed PDA pattern for bot balance (includes bot wallet)
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
        .updateSplitter(newParticipants, botWallet.publicKey) // Keep original bot wallet
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
      
      currentBotWallet = botWallet; // Keep original bot wallet
    } catch (error) {
      console.error("Update error:", error);
      throw error;
    }
  });

  it("Should create treasury account on client side", async () => {
    try {
      // Create the treasury account (client-side)
      const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        testMint,
        sharedSplitterConfigPda,
        true // Allow owner to be a PDA
      );
      
      console.log("✅ Treasury account created:", treasuryTokenAccount.address.toString());
      
      // Verify treasury was created and is empty
      const treasuryAccount = await getAccount(connection, sharedTreasuryPda);
      expect(treasuryAccount.amount).to.equal(BigInt(0)); // Should be empty initially
      expect(treasuryAccount.owner.toString()).to.equal(sharedSplitterConfigPda.toString());
      
    } catch (error) {
      console.error("Treasury creation error:", error);
      throw error;
    }
  });

  it("Should test claiming from empty treasury", async () => {
    try {
      // Try to claim from empty treasury (should fail)
      try {
        await program.methods
          .claimAndDistribute()
          .accountsPartial({
            bot: botWallet.publicKey,
            splitterConfig: sharedSplitterConfigPda,
            treasury: sharedTreasuryPda,
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
        expect(error.message).to.include("NoFundsToDistribute");
        console.log("✅ Correctly rejected claim from empty treasury");
      }
      
    } catch (error) {
      console.error("Empty treasury claim test error:", error);
      throw error;
    }
  });

  it("Should test actual token distribution with funds", async () => {
    try {
      // Transfer tokens from authority to treasury (client-side operation)
      const depositAmount = 1000000; // 1M tokens
      
      // Use transferChecked for more control
      const transferTx = await transfer(
        connection,
        wallet.payer,
        authorityTokenAta,
        sharedTreasuryPda,
        authority.publicKey,
        depositAmount
      );
      
      console.log("✅ Client transfer to treasury successful:", transferTx);

      // Wait a bit for the transfer to be confirmed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Now call claimAndDistribute to distribute the tokens
      const distributionTx = await program.methods
        .claimAndDistribute()
        .accountsPartial({
          bot: botWallet.publicKey,
          splitterConfig: sharedSplitterConfigPda,
          treasury: sharedTreasuryPda,
          treasuryMint: testMint,
          botTokenAccount: authorityTokenAta,
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

      console.log("✅ Token distribution successful:", distributionTx);

      // Verify treasury has funds (after bot tokens are transferred out)
      const treasuryAccount = await getAccount(connection, sharedTreasuryPda);
      const expectedBotAmount = Math.floor(depositAmount * 0.02);
      const expectedParticipantTotal = depositAmount - expectedBotAmount;
      expect(treasuryAccount.amount).to.equal(BigInt(expectedParticipantTotal));

      // Verify distribution results
      const finalBotBalance = await program.account.participantBalance.fetch(sharedBotBalancePda);
      const finalParticipantBalances = await Promise.all(
        sharedParticipantBalances.map(async (pda) => 
          await program.account.participantBalance.fetch(pda)
        )
      );

      // Verify bot got 2% (20,000 tokens)
      expect(finalBotBalance.amount.toNumber()).to.equal(expectedBotAmount);

      // Verify participants got their shares (98% total = 980,000 tokens)
      const totalParticipantAmount = finalParticipantBalances.reduce(
        (sum, balance) => sum + balance.amount.toNumber(), 0
      );
      expect(totalParticipantAmount).to.equal(expectedParticipantTotal);

      // Verify treasury has participant tokens ready for withdrawal
      const finalTreasuryAccount = await getAccount(connection, sharedTreasuryPda);
      expect(finalTreasuryAccount.amount).to.equal(BigInt(expectedParticipantTotal));
      
      console.log("✅ Token distribution test passed - Bot: 20,000, Participants: 980,000");
      
    } catch (error) {
      console.error("Token distribution test error:", error);
      throw error;
    }
  });

  it("Should reject unauthorized update attempt", async () => {
    try {
      const unauthorizedWallet = Keypair.generate();
      const newParticipants = [
        { wallet: participants[0].publicKey, shareBps: 5000 },
        { wallet: participants[1].publicKey, shareBps: 5000 }
      ];

      await program.methods
        .updateSplitter(newParticipants, botWallet.publicKey)
        .accountsPartial({
          authority: unauthorizedWallet.publicKey,
          splitterConfig: sharedSplitterConfigPda,
        })
        .signers([unauthorizedWallet])
        .rpc();

      throw new Error("Should have failed with unauthorized wallet");
    } catch (error) {
      console.log("Correctly rejected unauthorized update:", error.message);
      expect(error.message).to.include("ConstraintSeeds");
    }
  });

  it("Should allow all participants to withdraw their tokens", async () => {
    try {
      // Check initial token balances for all participants
      const initialBalances = await Promise.all(
        participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
      );
      const treasuryInitialBalance = await getAccount(connection, sharedTreasuryPda);
      
      console.log(`Treasury initial balance: ${treasuryInitialBalance.amount}`);
      
      // Get participant balance records before withdrawal
      const participantBalancesBefore = await Promise.all(
        sharedParticipantBalances.map(async (pda) => 
          await program.account.participantBalance.fetch(pda)
        )
      );
      
      // Log withdrawal amounts
      participantBalancesBefore.forEach((balance, i) => {
        console.log(`P${i+1} withdrawal amount: ${balance.amount.toNumber()}`);
      });
      
      // Ensure all participants have balances to withdraw
      participantBalancesBefore.forEach((balance, i) => {
        expect(balance.amount.toNumber()).to.be.greaterThan(0, `Participant ${i+1} should have balance > 0`);
      });
      
      // All participants withdraw their tokens
      const withdrawalTxs = [];
      for (let i = 0; i < 5; i++) {
        const withdrawTx = await program.methods
          .withdrawShare()
          .accountsPartial({
            authority: authority.publicKey,
            participant: participants[i].publicKey,
            splitterConfig: sharedSplitterConfigPda,
            participantBalance: sharedParticipantBalances[i],
            treasury: sharedTreasuryPda,
            treasuryMint: testMint,
            participantTokenAccount: participantTokenAtas[i],
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([participants[i]])
          .rpc();
        
        withdrawalTxs.push(withdrawTx);
        console.log(`✅ P${i+1} withdrawal successful:`, withdrawTx);
      }
      
      // Verify all withdrawals
      const finalBalances = await Promise.all(
        participantTokenAtas.map(async (ata) => await getAccount(connection, ata))
      );
      const treasuryFinalBalance = await getAccount(connection, sharedTreasuryPda);
      
      // Check that all participants received their tokens
      let totalWithdrawn = BigInt(0);
      for (let i = 0; i < 5; i++) {
        const received = finalBalances[i].amount - initialBalances[i].amount;
        const expected = BigInt(participantBalancesBefore[i].amount.toString());
        expect(received).to.equal(expected, `P${i+1} should receive correct amount`);
        totalWithdrawn += expected;
        console.log(`✅ P${i+1} received: ${received} tokens`);
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
        expect(balance.amount.toNumber()).to.equal(0, `P${i+1} balance should be reset to 0`);
      });
      
      console.log(`✅ All withdrawals completed successfully!`);
      console.log(`Total withdrawn: ${totalWithdrawn} tokens`);
      console.log(`Treasury remaining: ${treasuryFinalBalance.amount} tokens (should be 0)`);
      
    } catch (error) {
      console.error("Withdrawal test error:", error);
      throw error;
    }
  });

  it("Should verify contract state consistency", async () => {
    try {
      // Verify splitter config
      const config = await program.account.splitterConfig.fetch(sharedSplitterConfigPda);
      expect(config.authority.toString()).to.equal(authority.publicKey.toString());
      expect(config.name).to.equal(sharedSplitterName);
      expect(config.participants.length).to.equal(5);
      expect(config.botWallet.toString()).to.equal(currentBotWallet.publicKey.toString());
      expect(config.incentiveBps).to.equal(200);
      
      // Verify participant balances (may have been updated by distribution test)
      for (let i = 0; i < 5; i++) {
        const balance = await program.account.participantBalance.fetch(sharedParticipantBalances[i]);
        expect(balance.splitter.toString()).to.equal(sharedSplitterConfigPda.toString());
        expect(balance.participant.toString()).to.equal(participants[i].publicKey.toString());
        // Balance may be > 0 if distribution test ran (or 0 if withdrawn)
        expect(balance.amount.toNumber()).to.be.greaterThanOrEqual(0);
      }
      
      // Verify bot balance (may have been updated by distribution test)
      const botBalance = await program.account.participantBalance.fetch(sharedBotBalancePda);
      expect(botBalance.splitter.toString()).to.equal(sharedSplitterConfigPda.toString());
      expect(botBalance.participant.toString()).to.equal(botWallet.publicKey.toString()); // Use original bot wallet
      expect(botBalance.amount.toNumber()).to.be.greaterThanOrEqual(0); // May be > 0 if distribution test ran
      
    } catch (error) {
      console.error("Contract state verification error:", error);
      throw error;
    }
  });
});