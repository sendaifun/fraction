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
  getAssociatedTokenAddress,
  Account,
} from "@solana/spl-token";
import {
  SystemProgram,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import { expect } from "chai";
import { NATIVE_MINT } from "@solana/spl-token";

describe("Fraction Program - Dual PDA Distribution", () => {
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
  let systemTokenAccounts: Account;
  let treasuryTokenAccount: PublicKey;

  // Test setup - Dual PDA structure
  let fractionName: string;
  let fractionConfigPda: PublicKey;  // Program-owned PDA (stores data)
  let fractionVaultPda: PublicKey;  // System-owned PDA (holds assets)
  let testParticipants: any[];

  // Helper function to clean up treasury
  const cleanupTreasury = async () => {
    if (!treasuryTokenAccount) return;

    try {
      const treasuryAccount = await getAccount(
        connection,
        treasuryTokenAccount
      );
      if (treasuryAccount.amount > 0) {
        console.log(`Cleaning up treasury balance: ${treasuryAccount.amount}`);

        try {
          await program.methods
            .claimAndDistribute()
            .accountsPartial({
              authority: authority.publicKey,
              botWallet: botWallet.publicKey,
              fractionConfig: fractionConfigPda,
              fractionVault: fractionVaultPda,
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
    const airdropSig = await connection.requestAirdrop(
      botWallet.publicKey,
      5 * LAMPORTS_PER_SOL
    );
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
    authorityTokenAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        testMint,
        authority.publicKey
      )
    ).address;

    botTokenAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        testMint,
        botWallet.publicKey
      )
    ).address;

    participantTokenAtas = await Promise.all(
      participants.map(
        async (p) =>
          (
            await getOrCreateAssociatedTokenAccount(
              connection,
              wallet.payer,
              testMint,
              p.publicKey
            )
          ).address
      )
    );

    systemTokenAccounts = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      testMint,
      SystemProgram.programId,
      true
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

    // Setup test infrastructure - DUAL PDA STRUCTURE
    fractionName = "test_fraction";
    testParticipants = participants.map((p, i) => ({
      wallet: p.publicKey,
      shareBps: 2000, // 20% each
    }));

    [fractionConfigPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("fraction_config"),
        authority.publicKey.toBuffer(),
        Buffer.from(fractionName),
      ],
      program.programId
    );

    [fractionVaultPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("fraction_vault"),
        authority.publicKey.toBuffer(),
        Buffer.from(fractionName),
      ],
      program.programId
    );

    console.log("Config PDA:", fractionConfigPda.toString());
    console.log("Vault PDA:", fractionVaultPda.toString());
  });

  it("Should initialize fraction with dual PDA structure", async () => {
    const tx = await program.methods
      .initializeFraction(fractionName, testParticipants, botWallet.publicKey)
      .accountsPartial({
        authority: authority.publicKey,
        fractionConfig: fractionConfigPda,
        fractionVault: fractionVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([])
      .rpc();

    console.log("Initialize transaction:", tx);

    // Verify config was created
    const configAccount = await program.account.fractionConfig.fetch(fractionConfigPda);
    expect(configAccount.authority.toString()).to.equal(authority.publicKey.toString());
    expect(configAccount.name).to.equal(fractionName);
    console.log("Config account created successfully");
    console.log("Vault bump stored in config:", configAccount.vaultBump);
  });

  it("Should update fraction configuration", async () => {
    const newParticipants = [
      { wallet: participants[0].publicKey, shareBps: 3000 }, // 30%
      { wallet: participants[1].publicKey, shareBps: 2500 }, // 25%
      { wallet: participants[2].publicKey, shareBps: 2000 }, // 20%
      { wallet: participants[3].publicKey, shareBps: 1500 }, // 15%
      { wallet: participants[4].publicKey, shareBps: 1000 }, // 10%
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

  it("Should create treasury ATA owned by vault and deposit funds", async () => {
    treasuryTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        testMint,
        fractionVaultPda,
        true // Allow PDA owner
      )
    ).address;

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

    // Verify treasury balance and ownership
    const treasuryAccount = await getAccount(connection, treasuryTokenAccount);
    expect(treasuryAccount.amount).to.equal(BigInt(depositAmount));
    expect(treasuryAccount.owner.toString()).to.equal(
      fractionVaultPda.toString()
    );
  });

  it("Should distribute tokens from vault", async () => {
    const depositAmount = 1000000000;

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
        fractionVault: fractionVaultPda,
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

    console.log("Distribution transaction:", distributionTx);
  });

  it("Should handle multiple distribution rounds", async () => {
    await cleanupTreasury();
    const secondDeposit = 500000000;
    const secondDepositTx = await transfer(
      connection,
      wallet.payer,
      authorityTokenAta,
      treasuryTokenAccount,
      authority.publicKey,
      secondDeposit
    );

    console.log("Second treasury deposit transaction:", secondDepositTx);

    // Second distribution
    const secondDistributionTx = await program.methods
      .claimAndDistribute()
      .accountsPartial({
        authority: authority.publicKey,
        botWallet: botWallet.publicKey,
        fractionConfig: fractionConfigPda,
        fractionVault: fractionVaultPda,
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
          fractionVault: fractionVaultPda,
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
      console.log("Correctly rejected empty treasury distribution");
    }
  });

  it("Should handle WSOL distribution with dual PDA structure", async () => {
    // Create a new fraction config for WSOL testing
    const wsolFractionName = "wsol_test_fraction";
    const wsolTestParticipants = participants.map((p, i) => ({
      wallet: p.publicKey,
      shareBps: 2000, // 20% each
    }));

    // 🔑 WSOL Config and Vault PDAs
    const [wsolFractionConfigPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("fraction_config"),
        authority.publicKey.toBuffer(),
        Buffer.from(wsolFractionName),
      ],
      program.programId
    );

    const [wsolFractionVaultPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("fraction_vault"),
        authority.publicKey.toBuffer(),
        Buffer.from(wsolFractionName),
      ],
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
        fractionVault: wsolFractionVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([])
      .rpc();

    console.log("WSOL fraction config initialized:", initTx);

    // Create WSOL token accounts for all participants
    const wsolBotTokenAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        NATIVE_MINT,
        botWallet.publicKey
      )
    ).address;

    const wsolParticipantTokenAtas = await Promise.all(
      participants.map(
        async (p) =>
          (
            await getOrCreateAssociatedTokenAccount(
              connection,
              wallet.payer,
              NATIVE_MINT,
              p.publicKey
            )
          ).address
      )
    );

    const wsolTreasuryTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        NATIVE_MINT,
        wsolFractionVaultPda,
        true // Allow PDA owner
      )
    ).address;

    console.log(
      "WSOL treasury account created:",
      wsolTreasuryTokenAccount.toString()
    );

    // Transfer SOL directly to the WSOL treasury token account and sync
    const solAmount = 2 * LAMPORTS_PER_SOL; // 2 SOL
    const wrapTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wsolTreasuryTokenAccount,
        lamports: solAmount,
      }),
      createSyncNativeInstruction(wsolTreasuryTokenAccount)
    );

    const solTransferTx = await connection.sendTransaction(wrapTx, [
      wallet.payer,
    ]);
    await connection.confirmTransaction(solTransferTx);

    console.log("SOL transferred to WSOL treasury account:", solTransferTx);

    // Execute distribution
    const distributionTx = await program.methods
      .claimAndDistribute()
      .accountsPartial({
        authority: authority.publicKey,
        botWallet: botWallet.publicKey,
        fractionConfig: wsolFractionConfigPda,
        fractionVault: wsolFractionVaultPda,
        treasury: wsolTreasuryTokenAccount,
        treasuryMint: NATIVE_MINT, // WSOL native mint
        botTokenAccount: wsolBotTokenAta,
        participantTokenAccount0: wsolParticipantTokenAtas[0],
        participantTokenAccount1: wsolParticipantTokenAtas[1],
        participantTokenAccount2: wsolParticipantTokenAtas[2],
        participantTokenAccount3: wsolParticipantTokenAtas[3],
        participantTokenAccount4: wsolParticipantTokenAtas[4],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([botWallet])
      .rpc();

    console.log("WSOL distribution executed:", distributionTx);
  });

  it("Should reject unauthorized bot attempts", async () => {
    const unauthorizedBot = Keypair.generate();

    await cleanupTreasury();

    // seed vault with a small balance so the instruction can run
    await transfer(
      connection,
      wallet.payer,
      authorityTokenAta,
      treasuryTokenAccount,
      authority.publicKey,
      1_000_000
    );

    try {
      await program.methods
        .claimAndDistribute()
        .accountsPartial({
          authority: authority.publicKey,
          botWallet: unauthorizedBot.publicKey,
          fractionConfig: fractionConfigPda,
          fractionVault: fractionVaultPda,
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
      { wallet: participants[0].publicKey, shareBps: 5000 }, // 50 %
      { wallet: participants[1].publicKey, shareBps: 3000 }, // 30 %
      { wallet: participants[2].publicKey, shareBps: 2000 }, // 20 %
      { wallet: participants[3].publicKey, shareBps: 1000 }, // 10 %
      { wallet: participants[4].publicKey, shareBps: 500 }, //  5 %  → 115 % total
    ];

    try {
      await program.methods
        .updateFraction(invalidParticipants, botWallet.publicKey)
        .accountsPartial({
          authority: authority.publicKey,
          fractionConfig: fractionConfigPda,
        })
        .rpc();

      expect.fail("Should have failed with invalid share distribution");
    } catch (error) {
      expect(error.message).to.include("InvalidShareDistribution");
      console.log("Correctly rejected invalid share distribution");
    }
  });

  it("Should fail when System Program participant has non-zero share", async () => {
    const badParticipants = [
      { wallet: participants[0].publicKey, shareBps: 2500 },
      { wallet: participants[1].publicKey, shareBps: 2500 },
      { wallet: SystemProgram.programId, shareBps: 2500 },
      { wallet: participants[3].publicKey, shareBps: 1500 },
      { wallet: participants[4].publicKey, shareBps: 1000 },
    ];

    await program.methods
      .updateFraction(badParticipants, botWallet.publicKey)
      .accountsPartial({
        authority: authority.publicKey,
        fractionConfig: fractionConfigPda,
      })
      .rpc();

    await cleanupTreasury();
    await transfer(
      connection,
      wallet.payer,
      authorityTokenAta,
      treasuryTokenAccount,
      authority.publicKey,
      100_000_000
    );

    try {
      await program.methods
        .claimAndDistribute()
        .accountsPartial({
          authority: authority.publicKey,
          botWallet: botWallet.publicKey,
          fractionConfig: fractionConfigPda,
          fractionVault: fractionVaultPda,
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

      expect.fail("Distribution should have failed");
    } catch (error) {
      expect(error.message).to.include("SystemProgramParticipant");
      console.log("Correctly rejected distribution with System Program participant > 0 share");
    }
  });

  it("Should allow zero-share System Program participant", async () => {
    const okParticipants = [
      { wallet: participants[0].publicKey, shareBps: 3000 },
      { wallet: participants[1].publicKey, shareBps: 3000 },
      { wallet: SystemProgram.programId, shareBps: 0 },
      { wallet: participants[3].publicKey, shareBps: 2000 },
      { wallet: participants[4].publicKey, shareBps: 2000 },
    ];

    await program.methods
      .updateFraction(okParticipants, botWallet.publicKey)
      .accountsPartial({
        authority: authority.publicKey,
        fractionConfig: fractionConfigPda,
      })
      .rpc();

    await cleanupTreasury();
    await transfer(
      connection,
      wallet.payer,
      authorityTokenAta,
      treasuryTokenAccount,
      authority.publicKey,
      100_000_000
    );

    const tx = await program.methods
      .claimAndDistribute()
      .accountsPartial({
        authority: authority.publicKey,
        botWallet: botWallet.publicKey,
        fractionConfig: fractionConfigPda,
        fractionVault: fractionVaultPda,
        treasury: treasuryTokenAccount,
        treasuryMint: testMint,
        botTokenAccount: botTokenAta,
        participantTokenAccount0: participantTokenAtas[0],
        participantTokenAccount1: participantTokenAtas[1],
        participantTokenAccount2: systemTokenAccounts.address,
        participantTokenAccount3: participantTokenAtas[3],
        participantTokenAccount4: participantTokenAtas[4],
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([botWallet])
      .rpc();

    console.log("Distribution succeeded with zero-share System Program participant:", tx);
  });

  it("Should fail with duplicate participant wallets", async () => {
    const duplicateParticipants = [
      { wallet: participants[0].publicKey, shareBps: 2500 },
      { wallet: participants[1].publicKey, shareBps: 2500 },
      { wallet: participants[0].publicKey, shareBps: 2500 }, // Duplicate wallet
      { wallet: participants[3].publicKey, shareBps: 1500 },
      { wallet: participants[4].publicKey, shareBps: 1000 },
    ];

    try {
      await program.methods
        .updateFraction(duplicateParticipants, botWallet.publicKey)
        .accountsPartial({
          authority: authority.publicKey,
          fractionConfig: fractionConfigPda,
        })
        .rpc();

      expect.fail("Should have failed with duplicate participant wallets");
    } catch (error) {
      expect(error.message).to.include("DuplicateParticipantWallet");
      console.log("Correctly rejected duplicate participant wallets");
    }
  });

  it("Should fail when bot wallet conflicts with participant wallet", async () => {
    const conflictParticipants = [
      { wallet: participants[0].publicKey, shareBps: 2500 },
      { wallet: participants[1].publicKey, shareBps: 2500 },
      { wallet: participants[2].publicKey, shareBps: 2500 },
      { wallet: participants[3].publicKey, shareBps: 1500 },
      { wallet: participants[4].publicKey, shareBps: 1000 },
    ];

    try {
      // Try to set bot wallet to be the same as one of the participants
      await program.methods
        .updateFraction(conflictParticipants, participants[0].publicKey) // Bot wallet = participant[0]
        .accountsPartial({
          authority: authority.publicKey,
          fractionConfig: fractionConfigPda,
        })
        .rpc();

      expect.fail("Should have failed with bot wallet conflict");
    } catch (error) {
      expect(error.message).to.include("BotWalletConflict");
      console.log("Correctly rejected bot wallet conflict with participant");
    }
  });

  it("Should allow multiple System Program participants with zero shares", async () => {
    const multiSystemParticipants = [
      { wallet: participants[0].publicKey, shareBps: 5000 }, // 50%
      { wallet: participants[1].publicKey, shareBps: 5000 }, // 50%
      { wallet: SystemProgram.programId, shareBps: 0 },      // 0% - System Program
      { wallet: SystemProgram.programId, shareBps: 0 },      // 0% - System Program (duplicate)
      { wallet: SystemProgram.programId, shareBps: 0 },      // 0% - System Program (another duplicate)
    ];

    await program.methods
      .updateFraction(multiSystemParticipants, botWallet.publicKey)
      .accountsPartial({
        authority: authority.publicKey,
        fractionConfig: fractionConfigPda,
      })
      .rpc();

    console.log("Successfully updated fraction with multiple System Program participants with zero shares");

    // Test that distribution still works
    await cleanupTreasury();
    await transfer(
      connection,
      wallet.payer,
      authorityTokenAta,
      treasuryTokenAccount,
      authority.publicKey,
      100_000_000
    );

    const tx = await program.methods
      .claimAndDistribute()
      .accountsPartial({
        authority: authority.publicKey,
        botWallet: botWallet.publicKey,
        fractionConfig: fractionConfigPda,
        fractionVault: fractionVaultPda,
        treasury: treasuryTokenAccount,
        treasuryMint: testMint,
        botTokenAccount: botTokenAta,
        participantTokenAccount0: participantTokenAtas[0],
        participantTokenAccount1: participantTokenAtas[1],
        participantTokenAccount2: systemTokenAccounts.address,
        participantTokenAccount3: systemTokenAccounts.address,
        participantTokenAccount4: systemTokenAccounts.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([botWallet])
      .rpc();

    console.log("Distribution succeeded with multiple System Program participants:", tx);
  });

  it("Should handle custom token distribution with dual PDA structure", async () => {
    // Create a new custom token mint
    const customMint = await createMint(
      connection,
      wallet.payer,
      wallet.payer.publicKey,
      wallet.payer.publicKey,
      9 // 9 decimals for custom token
    );

    console.log("Custom token mint created:", customMint.toString());

    // Create a new fraction config for custom token testing
    const customTokenFractionName = "custom_token_fraction";
    const customTokenParticipants = [
      { wallet: participants[0].publicKey, shareBps: 2500 }, // 25%
      { wallet: participants[1].publicKey, shareBps: 2000 }, // 20%
      { wallet: participants[2].publicKey, shareBps: 2000 }, // 20%
      { wallet: participants[3].publicKey, shareBps: 1800 }, // 18%
      { wallet: participants[4].publicKey, shareBps: 1700 }, // 17%
    ];

    // Create custom token fraction config and vault PDAs
    const [customFractionConfigPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("fraction_config"),
        authority.publicKey.toBuffer(),
        Buffer.from(customTokenFractionName),
      ],
      program.programId
    );

    const [customFractionVaultPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("fraction_vault"),
        authority.publicKey.toBuffer(),
        Buffer.from(customTokenFractionName),
      ],
      program.programId
    );

    // Initialize custom token fraction config
    const initTx = await program.methods
      .initializeFraction(
        customTokenFractionName,
        customTokenParticipants,
        botWallet.publicKey
      )
      .accountsPartial({
        authority: authority.publicKey,
        fractionConfig: customFractionConfigPda,
        fractionVault: customFractionVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([])
      .rpc();

    console.log("Custom token fraction config initialized:", initTx);

    // Create token accounts for custom mint
    const customAuthorityTokenAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        customMint,
        authority.publicKey
      )
    ).address;

    const customBotTokenAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        customMint,
        botWallet.publicKey
      )
    ).address;

    const customParticipantTokenAtas = await Promise.all(
      participants.map(
        async (p) =>
          (
            await getOrCreateAssociatedTokenAccount(
              connection,
              wallet.payer,
              customMint,
              p.publicKey
            )
          ).address
      )
    );

    // Create custom token treasury account owned by vault
    const customTreasuryTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        wallet.payer,
        customMint,
        customFractionVaultPda,
        true // Allow PDA owner
      )
    ).address;

    console.log("Custom token treasury account created:", customTreasuryTokenAccount.toString());

    // Mint custom tokens to authority
    const customTokenAmount = 5000000000; // 5B custom tokens
    await mintTo(
      connection,
      wallet.payer,
      customMint,
      customAuthorityTokenAta,
      wallet.payer,
      customTokenAmount
    );

    console.log("Custom tokens minted to authority:", customTokenAmount);

    // Transfer custom tokens to treasury
    const depositAmount = 2000000000; // 2B custom tokens
    const depositTx = await transfer(
      connection,
      wallet.payer,
      customAuthorityTokenAta,
      customTreasuryTokenAccount,
      authority.publicKey,
      depositAmount
    );

    console.log("Custom tokens deposited to treasury:", depositTx);

    // Execute custom token distribution
    const distributionTx = await program.methods
      .claimAndDistribute()
      .accountsPartial({
        authority: authority.publicKey,
        botWallet: botWallet.publicKey,
        fractionConfig: customFractionConfigPda,
        fractionVault: customFractionVaultPda,
        treasury: customTreasuryTokenAccount,
        treasuryMint: customMint,
        botTokenAccount: customBotTokenAta,
        participantTokenAccount0: customParticipantTokenAtas[0],
        participantTokenAccount1: customParticipantTokenAtas[1],
        participantTokenAccount2: customParticipantTokenAtas[2],
        participantTokenAccount3: customParticipantTokenAtas[3],
        participantTokenAccount4: customParticipantTokenAtas[4],
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([botWallet])
      .rpc();

    console.log("Custom token distribution executed:", distributionTx);

  });

});
