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

    console.log("✅ Initialize transaction:", tx);

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

    console.log("✅ Update transaction:", updateTx);

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

    console.log("✅ Treasury account created:", treasuryTokenAccount.toString());

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

    console.log("✅ Treasury deposit transaction:", depositTx);
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

    console.log("✅ Direct distribution transaction:", distributionTx);

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

    console.log("\n=== Distribution Results ===");
    console.log(`Bot balance: ${initialBotBalance.amount} → ${finalBotBalance.amount} (received: ${botIncrease} tokens)`);
    console.log(`Treasury balance: ${depositAmount} → ${finalTreasuryBalance.amount} (distributed all funds)`);
    
    const expectedShares = [3000, 2500, 2000, 1500, 1000]; // From update test
    for (let i = 0; i < 5; i++) {
      const initialBalance = initialParticipantBalances[i].amount;
      const finalBalance = finalParticipantBalances[i].amount;
      const increase = finalBalance - initialBalance;
      const expectedAmount = Math.floor(expectedParticipantTotal * expectedShares[i] / 10000);
      
      expect(increase).to.equal(BigInt(expectedAmount));
      console.log(`P${i+1} balance: ${initialBalance} → ${finalBalance} (received: ${increase} tokens)`);
    }

    // Verify treasury is empty (all funds distributed)
    expect(finalTreasuryBalance.amount).to.equal(BigInt(0));

    console.log("✅ Direct distribution test passed - no withdrawal needed!");
  });

  it("Should handle multiple distribution rounds", async () => {
    // Add more funds for second distribution
    const secondDeposit = 500000000; // 500M tokens
    const secondDepositTx = await transfer(
      connection,
      wallet.payer,
      authorityTokenAta,
      treasuryTokenAccount,
      authority.publicKey,
      secondDeposit
    );

    console.log("✅ Second treasury deposit transaction:", secondDepositTx);

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

    console.log("✅ Second distribution transaction:", secondDistributionTx);

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
      console.log(`P${i+1} balance: ${beforeBalance} → ${afterBalance} (received: ${increase} tokens)`);
    }

    console.log("✅ Multiple distribution rounds work correctly");
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
          participantTokenAccount2: participantTokenAtas[2],
          participantTokenAccount3: participantTokenAtas[3],
          participantTokenAccount4: participantTokenAtas[4],
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([botWallet])
        .rpc();

      expect.fail("Should have failed with empty treasury");
    } catch (error) {
      expect(error.message).to.include("NoFundsToDistribute");
      console.log("✅ Correctly rejected empty treasury distribution");
    }
  });

  it("Should reject unauthorized bot attempts", async () => {
    const unauthorizedBot = Keypair.generate();
    
    // Add funds to test with
    const testDepositTx = await transfer(
      connection,
      wallet.payer,
      authorityTokenAta,
      treasuryTokenAccount,
      authority.publicKey,
      1000000
    );

    console.log("✅ Test deposit transaction:", testDepositTx);

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
      console.log("✅ Correctly rejected unauthorized bot");
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
      console.log("✅ Correctly rejected invalid share distribution");
    }
  });
});
