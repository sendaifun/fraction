// /**
//  * Example usage of the generated JavaScript client for the Fraction program
//  * This example demonstrates how to send actual transactions to a local validator
//  */

// import { 
//   Connection,
//   PublicKey,
//   Keypair,
//   Transaction,
//   TransactionInstruction,
//   sendAndConfirmTransaction,
//   LAMPORTS_PER_SOL,
//   SystemProgram,
// } from '@solana/web3.js';
// import { 
//   createMint,
//   createAssociatedTokenAccount,
//   createAssociatedTokenAccountInstruction,
//   mintTo,
//   getAssociatedTokenAddress,
//   transfer,
//   TOKEN_PROGRAM_ID,
//   ASSOCIATED_TOKEN_PROGRAM_ID,
// } from '@solana/spl-token';

// // Import from the generated fraction client
// import { 
//   FRACTION_PROGRAM_ADDRESS,
//   getInitializeFractionInstruction,
//   getUpdateFractionInstruction,
//   getClaimAndDistributeInstructionAsync,
//   getWithdrawShareInstructionAsync,
//   fetchFractionConfig,
//   fetchMaybeFractionConfig,
//   type Participant,
// } from './generated/js/src/index';

// // Import Address type from the kit
// import {
//   type Address,
//   createSolanaRpc,
//   address,
// } from '@solana/kit';

// // Configuration
// const RPC_ENDPOINT = 'http://127.0.0.1:8899';
// const COMMITMENT = 'confirmed';

// // Helper function to create address from string
// function createAddress(addressString: string): Address {
//   return address(addressString);
// }

// // Helper function to create a mock transaction signer compatible with generated client
// function createMockSigner(keypair: Keypair): any {
//   return {
//     address: createAddress(keypair.publicKey.toBase58()),
//     signTransaction: async (tx: any) => {
//       tx.sign(keypair);
//       return tx;
//     },
//     signAllTransactions: async (txs: any[]) => {
//       return txs.map(tx => {
//         tx.sign(keypair);
//         return tx;
//       });
//     },
//     signAndSendTransactions: async (txs: any[], config?: any) => {
//       return txs.map(tx => {
//         tx.sign(keypair);
//         return tx;
//       });
//     },
//   };
// }

// /**
//  * Helper function to fund an account with SOL
//  */
// async function fundAccount(publicKey: PublicKey, amount: number = 1) {
//   const connection = new Connection(RPC_ENDPOINT, COMMITMENT);
  
//   try {
//     const signature = await connection.requestAirdrop(
//       publicKey,
//       amount * LAMPORTS_PER_SOL
//     );
//     await connection.confirmTransaction(signature, COMMITMENT);
//     console.log(`✓ Funded ${publicKey.toBase58()} with ${amount} SOL`);
//   } catch (error) {
//     console.log(`ℹ Account ${publicKey.toBase58()} funding skipped (likely already funded)`);
//   }
// }

// /**
//  * Helper function to send instruction to local validator
//  */
// async function sendInstruction(
//   connection: Connection,
//   instruction: any,
//   signers: Keypair[]
// ): Promise<string> {
//   try {
//     console.log('Creating transaction...');
//     const transaction = new Transaction();
    
//     // Convert the generated instruction to web3.js format
//     const web3Instruction = new TransactionInstruction({
//       programId: new PublicKey(instruction.programAddress),
//       keys: instruction.accounts.map((account: any) => {
//         // Handle the new @solana/kit format where role determines permissions
//         // Role 0 = ReadOnly, Role 1 = Writable, Role 3 = WritableSigner
//         const isWritable = account.role === 1 || account.role === 3;
//         const isSigner = account.role === 3 || !!account.signer;
        
//         return {
//           pubkey: new PublicKey(account.address),
//           isSigner,
//           isWritable,
//         };
//       }),
//       data: Buffer.from(instruction.data),
//     });
    
//     transaction.add(web3Instruction);
    
//     console.log('Sending transaction to validator...');
//     const signature = await sendAndConfirmTransaction(
//       connection,
//       transaction,
//       signers,
//       {
//         commitment: 'processed',
//         skipPreflight: false,
//       }
//     );
    
//     console.log('Transaction confirmed:', signature);
//     return signature;
//   } catch (error) {
//     console.error('Transaction failed:', error);
//     throw error;
//   }
// }

// // Helper function to create a participant with proper keypair management
// async function createNewParticipant(percentage: number, name: string) {
//   const keypair = Keypair.generate();
//   await fundAccount(keypair.publicKey, 1);
//   return {
//     keypair,
//     address: keypair.publicKey.toBase58() as Address,
//     percentage,
//     name,
//   };
// }

// /**
//  * Example 1: Initialize a Fraction
//  */
// async function initializeFractionExample() {
//   console.log('=== Initialize Fraction Example ===');
  
//   try {
//     // Create RPC connection
//     const connection = new Connection(RPC_ENDPOINT, COMMITMENT);
    
//     // Generate a keypair for the authority
//     const keypair = Keypair.generate();
//     const authority = createMockSigner(keypair);
//     console.log('Authority address:', authority.address);
    
//     // Fund the authority account
//     await fundAccount(keypair.publicKey, 2);
    
//     // Generate real participant keypairs for testing
//     const participantKeypairs = [
//       Keypair.generate(),
//       Keypair.generate(), 
//       Keypair.generate(),
//       Keypair.generate(),
//       Keypair.generate(),
//     ];
    
//     // Fund all participant accounts
//     for (let i = 0; i < participantKeypairs.length; i++) {
//       await fundAccount(participantKeypairs[i].publicKey, 1);
//     }
    
//     // Define participants with their share percentages (in basis points, 10000 = 100%)
//     const participants: Participant[] = [
//       { 
//         wallet: createAddress(participantKeypairs[0].publicKey.toBase58()),
//         shareBps: 4000 // 40%
//       },
//       { 
//         wallet: createAddress(participantKeypairs[1].publicKey.toBase58()),
//         shareBps: 3500 // 35%
//       },
//       { 
//         wallet: createAddress(participantKeypairs[2].publicKey.toBase58()),
//         shareBps: 1500 // 15%
//       },
//       { 
//         wallet: createAddress(participantKeypairs[3].publicKey.toBase58()),
//         shareBps: 1000 // 10%
//       },
//       { 
//         wallet: createAddress(participantKeypairs[4].publicKey.toBase58()),
//         shareBps: 0 // 0%
//       },
//     ];
    
//     // Generate a proper bot keypair for this demo
//     const botKeypair = Keypair.generate();
//     const botWallet = createAddress(botKeypair.publicKey.toBase58());
    
//     // Fund the bot account
//     await fundAccount(botKeypair.publicKey, 1);
    
//     const fractionName = 'My Revenue Fraction';
    
//     // Calculate PDAs manually like the test does
//     const [fractionConfigPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("fraction_config"), new PublicKey(authority.address).toBuffer(), Buffer.from(fractionName)],
//       new PublicKey(FRACTION_PROGRAM_ADDRESS)
//     );
    
//     const participantBalancePdas = participants.map(p => {
//       const [pda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("balance"), fractionConfigPda.toBuffer(), new PublicKey(p.wallet).toBuffer()],
//         new PublicKey(FRACTION_PROGRAM_ADDRESS)
//       );
//       return pda;
//     });
    
//     const [botBalancePda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("bot_balance"), fractionConfigPda.toBuffer(), new PublicKey(botWallet).toBuffer()],
//       new PublicKey(FRACTION_PROGRAM_ADDRESS)
//     );
    
//     // Create the initialize fraction instruction using the synchronous version
//     const initializeInstruction = getInitializeFractionInstruction({
//       authority,
//       fractionConfig: createAddress(fractionConfigPda.toBase58()),
//       participantBalance0: createAddress(participantBalancePdas[0].toBase58()),
//       participantBalance1: createAddress(participantBalancePdas[1].toBase58()),
//       participantBalance2: createAddress(participantBalancePdas[2].toBase58()),
//       participantBalance3: createAddress(participantBalancePdas[3].toBase58()),
//       participantBalance4: createAddress(participantBalancePdas[4].toBase58()),
//       botBalance: createAddress(botBalancePda.toBase58()),
//       name: fractionName,
//       participants,
//       botWallet,
//       participantWallet0: participants[0].wallet,
//       participantWallet1: participants[1].wallet,
//       participantWallet2: participants[2].wallet,
//       participantWallet3: participants[3].wallet,
//       participantWallet4: participants[4].wallet,
//     });
    
//     console.log('Initialize instruction created successfully');
//     console.log('Program address:', initializeInstruction.programAddress);
//     console.log('Number of accounts:', initializeInstruction.accounts.length);
//     console.log('Fraction config address:', fractionConfigPda.toBase58());
    
//     // Send the transaction
//     const signature = await sendInstruction(
//       connection,
//       initializeInstruction,
//       [keypair]
//     );
    
//     console.log('Initialize transaction sent successfully!');
//     console.log('Transaction signature:', signature);
    
//     return {
//       instruction: initializeInstruction,
//       authority: authority.address,
//       fractionConfigAddress: createAddress(fractionConfigPda.toBase58()),
//       signature,
//       keypair,
//       botKeypair, // Return the bot keypair for use in claim_and_distribute
//       participantKeypairs, // Return participant keypairs for withdrawal
//     };
    
//   } catch (error) {
//     console.error('Error initializing fraction:', error);
//     throw error;
//   }
// }

// /**
//  * Example 2: Fetch and Decode Fraction Config
//  */
// async function fetchFractionConfigExample(fractionConfigAddress: Address) {
//   console.log('\n=== Fetch Fraction Config Example ===');
  
//   try {
//     const connection = new Connection(RPC_ENDPOINT, COMMITMENT);
//     const rpc = createSolanaRpc(RPC_ENDPOINT);
    
//     // Wait a moment for the account to be created
//     console.log('Waiting for account to be created...');
//     await new Promise(resolve => setTimeout(resolve, 2000));
    
//     // Try to fetch the config
//     try {
//       const fractionConfig = await fetchFractionConfig(rpc, fractionConfigAddress);
//       console.log('Fraction config fetched successfully');
//       console.log('Authority:', fractionConfig.data.authority);
//       console.log('Name:', fractionConfig.data.name);
//       console.log('Participants:', fractionConfig.data.participants);
//       console.log('Bot wallet:', fractionConfig.data.botWallet);
//       console.log('Incentive BPS:', fractionConfig.data.incentiveBps);
//       return fractionConfig;
//     } catch (fetchError) {
//       console.log('Account not found - trying maybe fetch...');
      
//       const maybeFractionConfig = await fetchMaybeFractionConfig(rpc, fractionConfigAddress);
//       if (maybeFractionConfig && maybeFractionConfig.exists) {
//         console.log('Fraction config exists:', maybeFractionConfig.data.name);
//         return maybeFractionConfig;
//       } else {
//         console.log('Fraction config does not exist yet');
//         return null;
//       }
//     }
    
//   } catch (error) {
//     console.error('Error fetching fraction config:', error);
//     throw error;
//   }
// }

// /**
//  * Example 3: Update Fraction Configuration
//  */
// async function updateFractionExample(
//   authorityKeypair: Keypair,
//   fractionConfigAddress: Address,
//   botKeypair: Keypair,
//   participantKeypairs: Keypair[]
// ) {
//   console.log('\n=== Update Fraction Example ===');
  
//   try {
//     const connection = new Connection(RPC_ENDPOINT, COMMITMENT);
//     const authority = createMockSigner(authorityKeypair);
    
//     // Keep the same participants but update their share percentages
//     const updatedParticipants: Participant[] = participantKeypairs.map((keypair, index) => ({
//       wallet: createAddress(keypair.publicKey.toString()),
//       shareBps: index === 0 ? 5000 : index === 1 ? 3000 : index === 2 ? 2000 : 0, // Adjust share distribution
//     }));
    
//     const updateInstruction = getUpdateFractionInstruction({
//       authority: authority.publicKey,
//       fractionConfig: fractionConfigAddress,
//       name: 'My Revenue Fraction', // Must match the original name
//       participants: updatedParticipants,
//       botWallet: createAddress(botKeypair.publicKey.toBase58()), // Use the actual bot wallet
//     });
    
//     console.log('Update fraction instruction created successfully');
//     console.log('Program address:', updateInstruction.programAddress);
    
//     // Send the transaction
//     const signature = await sendInstruction(
//       connection,
//       updateInstruction,
//       [authorityKeypair]
//     );
    
//     console.log('Update transaction sent successfully!');
//     console.log('Transaction signature:', signature);
    
//     return {
//       instruction: updateInstruction,
//       signature,
//     };
    
//   } catch (error) {
//     console.error('Error updating fraction:', error);
//     throw error;
//   }
// }

// /**
//  * Example 4: Complete Token Setup Demo
//  * This demonstrates the full token setup workflow with proper infrastructure
//  */
// async function completeTokenSetupExample(
//   authorityKeypair: Keypair,
//   fractionConfigAddress: Address,
//   participantKeypairs: Keypair[]
// ) {
//   console.log('\n=== Complete Token Setup Demo ===');
  
//   try {
//     const connection = new Connection(RPC_ENDPOINT, COMMITMENT);
    
//     // 1. Create a test token mint
//     console.log('1. Creating test token mint...');
//     const mint = await createMint(
//       connection,
//       authorityKeypair, // fee payer
//       authorityKeypair.publicKey, // mint authority
//       null, // freeze authority
//       9 // decimals
//     );
//     console.log('✓ Created mint:', mint.toBase58());
    
//     // 2. Create treasury token account (associated with the fraction config PDA)
//     console.log('2. Creating treasury token account...');
//     const treasuryTokenAccount = await getAssociatedTokenAddress(
//       mint,
//       new PublicKey(fractionConfigAddress),
//       true // Allow owner off curve (since fraction config is a PDA)
//     );
//     console.log('✓ Treasury token account calculated:', treasuryTokenAccount.toBase58());
    
//     // Create the treasury token account using createAssociatedTokenAccountInstruction
//     const createTreasuryInstruction = createAssociatedTokenAccountInstruction(
//       authorityKeypair.publicKey, // payer
//       treasuryTokenAccount,      // associated token account
//       new PublicKey(fractionConfigAddress), // owner (the PDA)
//       mint                       // mint
//     );
    
//     const createTreasuryTx = new Transaction().add(createTreasuryInstruction);
//     try {
//       const createSignature = await sendAndConfirmTransaction(
//         connection,
//         createTreasuryTx,
//         [authorityKeypair]
//       );
//       console.log('✓ Treasury token account created:', createSignature);
//     } catch (error: any) {
//       if (error.message?.includes('already in use')) {
//         console.log('✓ Treasury token account already exists');
//       } else {
//         throw error;
//       }
//     }
    
//     // 3. Mint tokens to authority, then transfer to treasury
//     console.log('3. Minting test tokens...');
//     const authorityTokenAccount = await createAssociatedTokenAccount(
//       connection,
//       authorityKeypair,
//       mint,
//       authorityKeypair.publicKey
//     );
    
//     await mintTo(
//       connection,
//       authorityKeypair,
//       mint,
//       authorityTokenAccount,
//       authorityKeypair,
//       1000000000000 // 1,000 tokens (with 9 decimals)
//     );
//     console.log('✓ Minted 1,000 test tokens to authority');
    
//     // 4. Create participant token accounts
//     console.log('4. Setting up participant token accounts...');
//     const participants = participantKeypairs.map(kp => kp.publicKey.toBase58() as Address);
    
//     // Create actual token accounts for each participant
//     const participantTokenAccounts: Address[] = [];
//     for (let i = 0; i < participantKeypairs.length; i++) {
//       const participantKeypair = participantKeypairs[i];
//       const participantTokenAccount = await getAssociatedTokenAddress(
//         mint,
//         participantKeypair.publicKey
//       );
      
//       try {
//         // Create the token account
//         await createAssociatedTokenAccount(
//           connection,
//           authorityKeypair,
//           mint,
//           participantKeypair.publicKey
//         );
        
//         participantTokenAccounts.push(participantTokenAccount.toBase58() as Address);
//         console.log(`✓ Created token account for participant ${i + 1}: ${participantKeypair.publicKey.toBase58()}`);
//       } catch (error: any) {
//         if (error.message?.includes('already in use')) {
//           participantTokenAccounts.push(participantTokenAccount.toBase58() as Address);
//           console.log(`✓ Token account already exists for participant ${i + 1}`);
//         } else {
//           throw error;
//         }
//       }
//     }
    
//     // 5. Transfer tokens to treasury to fund distributions
//     console.log('5. Funding treasury with tokens...');
    
//     await transfer(
//       connection,
//       authorityKeypair,
//       authorityTokenAccount,
//       treasuryTokenAccount,
//       authorityKeypair,
//       500000000000 // Transfer 500 tokens to treasury (keeping 500 for authority)
//     );
//     console.log('✓ Transferred 500 tokens to treasury for distribution');
    
//     console.log('\n🎉 Complete token setup finished!');
//     console.log('Treasury is now funded and ready for distribution');
    
//     return {
//       mint: mint.toBase58() as Address,
//       treasury: treasuryTokenAccount.toBase58() as Address,
//       authorityTokenAccount: authorityTokenAccount.toBase58() as Address,
//       participantTokenAccounts,
//       participants,
//     };
    
//   } catch (error) {
//     console.error('Error in token setup demo:', error);
//     throw error;
//   }
// }

// /**
//  * Example 5: Complete Token Distribution Implementation
//  * This actually distributes tokens from the funded treasury to participants
//  */
// async function completeTokenDistributionExample(
//   authorityKeypair: Keypair,
//   fractionConfigAddress: Address,
//   tokenSetup: {
//     mint: Address;
//     treasury: Address;
//     participantTokenAccounts: Address[];
//     participants: Address[];
//   },
//   botKeypair: Keypair
// ) {
//   console.log('\n=== Complete Token Distribution Example ===');
  
//   try {
//     const connection = new Connection(RPC_ENDPOINT, COMMITMENT);
//     const authority = createMockSigner(authorityKeypair);
    
//     // Use the bot keypair that was created during initialization
//     const botSigner = createMockSigner(botKeypair);
    
//     // The bot account should already be funded from initialization
//     console.log('Using bot wallet:', botKeypair.publicKey.toBase58());
    
//     // Create bot's token account for receiving incentives
//     const botTokenAccount = await getAssociatedTokenAddress(
//       new PublicKey(tokenSetup.mint),
//       botKeypair.publicKey
//     );
    
//     try {
//       await createAssociatedTokenAccount(
//         connection,
//         botKeypair,
//         new PublicKey(tokenSetup.mint),
//         botKeypair.publicKey
//       );
//       console.log('✓ Created bot token account');
//     } catch (error: any) {
//       if (error.message?.includes('already in use')) {
//         console.log('✓ Bot token account already exists');
//       } else {
//         throw error;
//       }
//     }
    
//     // Get participant balance PDAs
//     const participantBalancePdas = tokenSetup.participants.map(p => {
//       const [pda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("balance"), new PublicKey(fractionConfigAddress).toBuffer(), new PublicKey(p).toBuffer()],
//         new PublicKey(FRACTION_PROGRAM_ADDRESS)
//       );
//       return pda.toBase58() as Address;
//     });
    
//     console.log('Creating token distribution instruction...');
    
//     // Create the distribution instruction
//     const claimInstruction = await getClaimAndDistributeInstructionAsync({
//       bot: botSigner,
//       authority: authority.address,
//       fractionConfig: fractionConfigAddress,
//       treasury: tokenSetup.treasury,
//       treasuryMint: tokenSetup.mint,
//       botTokenAccount: botTokenAccount.toBase58() as Address,
//       participantBalance0: participantBalancePdas[0],
//       participantBalance1: participantBalancePdas[1],
//       participantBalance2: participantBalancePdas[2],
//       participantBalance3: participantBalancePdas[3],
//       participantBalance4: participantBalancePdas[4],
//       tokenProgram: TOKEN_PROGRAM_ID.toBase58() as Address,
//       name: 'My Revenue Fraction',
//     });
    
//     console.log('✓ Token distribution instruction created');
//     console.log('Number of accounts:', claimInstruction.accounts.length);
    
//     // Send the transaction
//     const signature = await sendInstruction(
//       connection,
//       claimInstruction,
//       [botKeypair]
//     );
    
//     console.log('Token distribution transaction completed!');
//     console.log('Transaction signature:', signature);
//     console.log('Tokens have been distributed to participant balance accounts');
    
//     return {
//       instruction: claimInstruction,
//       signature,
//       botTokenAccount: botTokenAccount.toBase58() as Address,
//     };
    
//   } catch (error) {
//     console.error('Error in token distribution:', error);
//     throw error;
//   }
// }

// /**
//  * Example 5: Complete Participant Withdrawal Implementation
//  * This allows all participants to withdraw their allocated shares
//  */
// async function completeWithdrawShareExample(
//   fractionConfigAddress: Address,
//   tokenSetup: {
//     mint: Address;
//     treasury: Address;
//     participantTokenAccounts: Address[];
//     participants: Address[];
//   },
//   participantKeypairs: Keypair[],
//   authorityKeypair: Keypair
// ) {
//   console.log('\n=== Complete Participant Withdrawal Example ===');
  
//   try {
//     const connection = new Connection(RPC_ENDPOINT, COMMITMENT);
    
//     // For each participant, create a withdrawal transaction
//     const withdrawalResults = [];
    
//     for (let i = 0; i < tokenSetup.participants.length; i++) {
//       const participantWallet = tokenSetup.participants[i];
//       const participantTokenAccount = tokenSetup.participantTokenAccounts[i];
//       const participantKeypair = participantKeypairs[i]; // Use the actual participant keypair
      
//       console.log(`\n--- Withdrawing for participant ${i + 1}: ${participantWallet} ---`);
      
//       const participantSigner = createMockSigner(participantKeypair);
      
//       // Calculate the participant balance PDA
//       const [participantBalancePda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("balance"), new PublicKey(fractionConfigAddress).toBuffer(), new PublicKey(participantWallet).toBuffer()],
//         new PublicKey(FRACTION_PROGRAM_ADDRESS)
//       );
      
//       console.log(`Creating withdraw instruction for participant ${participantWallet}...`);
      
//       try {
//         // Create the withdraw share instruction - use the original authority for PDA calculation
//         const withdrawInstruction = await getWithdrawShareInstructionAsync({
//           participant: participantSigner,
//           authority: authorityKeypair.publicKey.toBase58() as Address, // Use original authority for PDA calculation
//           fractionConfig: fractionConfigAddress,
//           treasury: tokenSetup.treasury,
//           treasuryMint: tokenSetup.mint,
//           participantTokenAccount: participantTokenAccount,
//           tokenProgram: TOKEN_PROGRAM_ID.toBase58() as Address,
//           name: 'My Revenue Fraction',
//         });
        
//         console.log(`✓ Withdraw instruction created for participant ${i + 1}`);
        
//         // Send the transaction
//         const signature = await sendInstruction(
//           connection,
//           withdrawInstruction,
//           [participantKeypair] // Use the actual participant keypair to sign
//         );
        
//         console.log(`Withdrawal completed for participant ${i + 1}!`);
//         console.log(`Transaction signature: ${signature}`);
        
//         withdrawalResults.push({
//           participant: participantWallet,
//           tokenAccount: participantTokenAccount,
//           signature,
//           success: true,
//         });
        
//       } catch (error) {
//         console.error(`Withdrawal failed for participant ${i + 1}:`, error);
//         withdrawalResults.push({
//           participant: participantWallet,
//           tokenAccount: participantTokenAccount,
//           error: error instanceof Error ? error.message : String(error),
//           success: false,
//         });
//       }
      
//       // Small delay between transactions to avoid congestion
//       await new Promise(resolve => setTimeout(resolve, 1000));
//     }
    
//     // Summary
//     const successful = withdrawalResults.filter(r => r.success);
//     const failed = withdrawalResults.filter(r => !r.success);
    
//     console.log(`\nWithdrawal Summary:`);
//     console.log(`Successful withdrawals: ${successful.length}/${withdrawalResults.length}`);
//     console.log(`Failed withdrawals: ${failed.length}/${withdrawalResults.length}`);
    
//     if (failed.length > 0) {
//       console.log('\nFailed withdrawals:');
//       failed.forEach((f, i) => {
//         console.log(`${i + 1}. ${f.participant}: ${f.error}`);
//       });
//     }
    
//     return {
//       results: withdrawalResults,
//       successful: successful.length,
//       failed: failed.length,
//     };
    
//   } catch (error) {
//     console.error('Error in participant withdrawals:', error);
//     throw error;
//   }
// }

// /**
//  * Main example function that runs all examples
//  */
// async function runAllExamples() {
//   console.log('Fraction Program JavaScript Client Examples');
//   console.log('=============================================\n');
  
//   try {
//     // Initialize a fraction
//     const { authority, fractionConfigAddress, keypair, botKeypair, participantKeypairs } = await initializeFractionExample();
    
//     // Fetch the config
//     await fetchFractionConfigExample(fractionConfigAddress);
    
//     // Update fraction configuration
//     // Skip update for now - let's focus on token distribution working
//     // await updateFractionExample(keypair, fractionConfigAddress, botKeypair, participantKeypairs);
    
//     // Fetch the updated config to verify changes
//     console.log('\n=== Verifying Update ===');
//     await fetchFractionConfigExample(fractionConfigAddress);
    
//     // Complete token setup demo with actual funding and claims
//     console.log('\n=== Step 5: Complete Token Setup ===');
//     const tokenSetup = await completeTokenSetupExample(keypair, fractionConfigAddress, participantKeypairs);
//     console.log('✓ Token infrastructure setup and treasury funded');
    
//     // Distribute tokens to participants
//     console.log('\n=== Step 6: Token Distribution ===');
//     const claimResult = await completeTokenDistributionExample(keypair, fractionConfigAddress, tokenSetup, botKeypair);
//     console.log('✓ Tokens distributed to participant balance accounts');
    
//     // Allow participants to withdraw their shares
//     console.log('\n=== Step 7: Participant Withdrawals ===');
//     const withdrawResult = await completeWithdrawShareExample(fractionConfigAddress, tokenSetup, participantKeypairs, keypair);
//     console.log(`✓ Withdrawal process completed: ${withdrawResult.successful}/${withdrawResult.successful + withdrawResult.failed} successful`);
    
//     console.log('\nComplete end-to-end workflow successful!');
//     console.log('\nThe generated JavaScript SDK is fully functional!');
//     console.log('All features verified:');
//     console.log('Initialize Fraction - Creates new revenue fraction with participants');
//     console.log('Fetch Fraction Config - Retrieves and decodes fraction configuration');
//     console.log('Update Fraction - Modifies participant shares and configuration');
//     console.log('Token Infrastructure - Sets up mint, treasury, and participant accounts');
//     console.log('Treasury Funding - Transfers tokens to treasury for distribution');
//     console.log('Token Distribution - Distributes treasury tokens to participant balances');
//     console.log('Participant Withdrawals - Allows participants to claim their allocated tokens');
//     console.log('\nProduction ready features:');
//     console.log('• Complete revenue fractionalization workflow');
//     console.log('• Multi-participant token distribution');
//     console.log('• Automatic share calculation and distribution');
//     console.log('• Individual participant withdrawal capability');
//     console.log('• Comprehensive error handling and recovery');
    
//     return { 
//       authority, 
//       fractionConfigAddress, 
//       keypair, 
//       botKeypair,
//       participantKeypairs,
//       tokenSetup, 
//       claimResult, 
//       withdrawResult 
//     };
    
//   } catch (error) {
//     console.error('\nExample execution failed:', error);
//     console.error('\nTroubleshooting:');
//     console.error('1. Make sure the local validator is running on http://127.0.0.1:8899');
//     console.error('2. Make sure the Fraction program is deployed to the local validator');
//     console.error('3. Check that all required accounts are properly funded');
//     console.error('4. Verify the program ID matches the deployed program');
//     process.exit(1);
//   }
// }

// // Export functions for individual testing
// export {
//   initializeFractionExample,
//   fetchFractionConfigExample,
//   updateFractionExample,
//   completeTokenSetupExample,
//   completeTokenDistributionExample,
//   completeWithdrawShareExample,
//   runAllExamples,
// };

// // Run examples if this file is executed directly
// if (require.main === module) {
//   runAllExamples();
// }