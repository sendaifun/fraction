# Fraction SDK

TypeScript SDK for integrating with the Fraction protocol - split any transaction into fraction on Solana.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Client Class](#client-class)
  - [Instructions](#instructions)
  - [State Queries](#state-queries)
- [Code Examples](#code-examples)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)

---

## Installation

```bash
pnpm install @sendaifun/fraction
```

## Quick Start

### Initialize Client

```typescript
import { Fraction } from '@sendaifun/fraction';
import { Connection, Keypair } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const payer = Keypair.generate();

// Initialize client
const client = new Fraction(
  'https://api.devnet.solana.com', // RPC endpoint
  payer.publicKey                  // Transaction payer
);
```

### Create Revenue Split Configuration

```typescript
const participants = [
  { wallet: teamMember1.publicKey, shareBps: 4000 }, // 40%
  { wallet: teamMember2.publicKey, shareBps: 3000 }, // 30%
  { wallet: teamMember3.publicKey, shareBps: 2000 }, // 20%
  { wallet: teamMember4.publicKey, shareBps: 1000 }, // 10%
];

const { tx, fractionConfigPda } = await client.createFraction({
  participants,
  authority: authority.publicKey,
  name: 'team-revenue-split',
  botWallet: distributionAgent.publicKey
});
```

### Execute Distribution

```typescript
// Agent triggers distribution
const tx = await client.claimAndDistribute(
  fractionConfigPda,     // Configuration account
  usdcMint               // Token mint to distribute
);
```

---

## API Reference

### Client Class

#### Constructor

```typescript
new Fraction(rpc?: string, payer?: PublicKey)
```

**Parameters:**
- `rpc` - RPC endpoint (defaults to mainnet-beta)
- `payer` - Transaction fee payer (only required for versioned transaction)

#### Methods

##### `createFraction(input: CreatorFractionInputArgs)`

Creates new revenue split configuration.

**Input Type:**
```typescript
type CreatorFractionInputArgs = {
  participants: Participant[];
  authority: PublicKey;
  name?: string;
  botWallet: PublicKey;
}
```

**Returns:** `Promise<{ tx: Transaction | VersionedTransaction, fractionConfigPda: PublicKey }>`

##### `updateFraction(config: PublicKey, input: UpdateFractionInputArgs)`

Updates existing configuration.

**Input Type:**
```typescript
type UpdateFractionInputArgs = {
  participants: Participant[];
  botWallet?: PublicKey;
}
```

**Returns:** `Promise<Transaction | VersionedTransaction>`

##### `claimAndDistribute(config: PublicKey, mint: PublicKey)`

Executes distribution to all participants.

**Returns:** `Promise<Transaction | VersionedTransaction>`

### Instructions

Low-level instruction builders for advanced usage.

#### `createFractionIx(program: Program<Fraction>, input: CreatorFractionInputArgs)`

**Returns:** `Promise<{ ix: TransactionInstruction, fractionConfigPda: PublicKey }>`

#### `updateFractionIx(program: Program<Fraction>, config: PublicKey, input: UpdateFractionInputArgs)`

**Returns:** `Promise<TransactionInstruction>`

#### `claimAndDistributeIx(program: Program<Fraction>, config: PublicKey, mint: PublicKey)`

**Returns:** `Promise<TransactionInstruction>`

### State Queries

#### `getFractionsByParticipant(participant: PublicKey)`

Retrieves all configurations where wallet is a participant.

**Returns:** `Promise<FractionConfig[]>`

#### `getFractionsByConfig(config: PublicKey)`

Retrieves specific configuration account.

**Returns:** `Promise<FractionConfig>`

#### `getFractionBalance(config: PublicKey)`

Gets treasury balance for configuration.

**Returns:** `Promise<FractionConfig>`

---

## Code Examples

### Enterprise Revenue Distribution

```typescript
import { Fraction } from '@sendaifun/fraction';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const client = new Fraction(connection.rpcEndpoint, authority.publicKey);

// Define revenue allocation
const participants = [
  { wallet: founder.publicKey, shareBps: 4000 },    // 40% founder
  { wallet: team.publicKey, shareBps: 3000 },       // 30% team  
  { wallet: investors.publicKey, shareBps: 2000 },  // 20% investors
  { wallet: operations.publicKey, shareBps: 1000 }  // 10% operations
];

// Deploy configuration
const { tx, fractionConfigPda } = await client.createFraction({
  participants,
  authority: company.publicKey,
  name: 'quarterly-revenue-2024',
  botWallet: automatedAgent.publicKey
});

// Sign and submit
await connection.sendTransaction(tx, [authority]);
```

### Multi-Token Distribution System

```typescript
const tokens = [
  { mint: usdcMint, name: 'USDC Revenue' },
  { mint: solMint, name: 'SOL Rewards' },
  { mint: projectToken, name: 'Token Emissions' }
];

// Distribute multiple tokens using same configuration
for (const token of tokens) {
  const distributionTx = await client.claimAndDistribute(
    fractionConfigPda,
    token.mint
  );
  
  await connection.sendTransaction(distributionTx, [agent]);
  console.log(`Distributed ${token.name}`);
}
```

### Dynamic Configuration Updates

```typescript
// Quarterly rebalancing
const newAllocation = [
  { wallet: founder.publicKey, shareBps: 3500 },    // Reduced to 35%
  { wallet: team.publicKey, shareBps: 3500 },       // Increased to 35%
  { wallet: investors.publicKey, shareBps: 2000 },  // Maintained 20%
  { wallet: operations.publicKey, shareBps: 1000 }  // Maintained 10%
];

const updateTx = await client.updateFraction(fractionConfigPda, {
  participants: newAllocation,
  botWallet: newAgent.publicKey // Optional: update agent
});

await connection.sendTransaction(updateTx, [authority]);
```

---

## Error Handling

### Common Validation Errors

The SDK implements client-side validation and provides clear error messages:

```typescript
try {
  await client.createFraction({
    participants: invalidParticipants,
    authority: authority.publicKey,
    botWallet: agent.publicKey
  });
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

### Protocol Error Codes

| Error | Description |
|-------|-------------|
| `InvalidShareDistribution` | Participant shares don't sum to 10,000 BPS |
| `NoFundsToDistribute` | Treasury account is empty |
| `DuplicateParticipantWallet` | Same wallet appears multiple times |
| `BotWalletConflict` | Agent wallet matches participant wallet |
| `SystemProgramParticipant` | System program cannot have non-zero shares |

### Error Handling Pattern

```typescript
import { Fraction } from '@sendaifun/fraction';

async function safeDistribution(config: PublicKey, mint: PublicKey) {
  try {
    const tx = await client.claimAndDistribute(config, mint);
    const signature = await connection.sendTransaction(tx, [agent]);
    return { success: true, signature };
  } catch (error) {
    if (error.message.includes('NoFundsToDistribute')) {
      return { success: false, reason: 'Treasury empty' };
    }
    throw error; // Re-throw unexpected errors
  }
}
```

---

## Advanced Usage

### Custom Instruction Building

Build complex transactions with multiple operations:

```typescript
import { createFractionIx, getProgram } from '@sendaifun/fraction';
import { Transaction } from '@solana/web3.js';

const program = getProgram(connection);

// Create instruction
const { ix, fractionConfigPda } = await createFractionIx(program, {
  participants: participants,
  authority: authority.publicKey,
  botWallet: agent.publicKey
});

// Build composite transaction
const tx = new Transaction()
  .add(setupInstruction)
  .add(ix)
  .add(followupInstruction);
```

### Treasury Account Management

```typescript
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

// Calculate treasury address
const treasuryAddress = getAssociatedTokenAddressSync(
  tokenMint,          // Token to be distributed
  fractionConfigPda,  // Treasury owner (PDA)
  true                // Allow off-curve addresses
);

// Fund treasury
await transfer(
  connection,
  payer,
  sourceTokenAccount,
  treasuryAddress,
  authority,
  amount
);
```

### Configuration Account Derivation

```typescript
import { PublicKey } from '@solana/web3.js';

// Derive configuration PDA
const [configPda, bump] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("fraction_config"),
    authority.toBuffer(),
    Buffer.from(configurationName)
  ],
  programId
);
```

### Type Definitions

```typescript
type Participant = {
  wallet: PublicKey;
  shareBps: number; // 0-10,000 basis points
}

type FractionConfig = {
  authority: PublicKey;
  name: string;
  participants: Participant[];
  botWallet: PublicKey;
  incentiveBps: number;
  bump: number;
}
```
