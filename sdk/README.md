# SendSplits SDK

A TypeScript SDK for interacting with the SendSplits Solana program - a revenue sharing and token distribution platform that allows automatic splitting of funds among multiple participants.

## Overview

SendSplits enables you to:
- Create fraction configurations with up to 5 participants
- Define custom share distributions using basis points (BPS)
- Automatically distribute tokens from a treasury to participants
- Update participant configurations
- Claim and distribute accumulated funds

## Installation

```bash
pnpm install @solana/web3.js @solana/spl-token @coral-xyz/anchor
```

## Quick Start

```typescript
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { createFraction, claimAndDistribute } from './sdk';

const connection = new Connection('https://api.devnet.solana.com');
const authority = Keypair.generate();
const participants = [
  { wallet: new PublicKey('...'), shareBps: 5000 }, // 50%
  { wallet: new PublicKey('...'), shareBps: 3000 }, // 30%
  { wallet: new PublicKey('...'), shareBps: 2000 }, // 20%
];

// Create a new fraction
const tx = await createFraction({
  participants,
  authority: authority.publicKey,
  name: 'my-revenue-split',
  botWallet: new PublicKey('...')
}, connection, authority.publicKey);
```

## Core Concepts

### Participants
Each participant has:
- **wallet**: The recipient's public key
- **shareBps**: Share in basis points (1-10000, where 10000 = 100%)

### Fraction Configuration
A fraction configuration contains:
- **authority**: The owner who can modify the configuration
- **name**: A unique identifier for the fraction
- **participants**: Array of up to 5 participants
- **botWallet**: Wallet authorized to trigger distributions
- **incentiveBps**: Bot incentive in basis points

### Share Distribution Rules
- Total shares must sum to exactly 10,000 BPS (100%)
- Individual shares can range from 0 to 10,000 BPS
- System program (11111111111111111111111111111111) can be used as a participant with 0 shares (burn address)

## API Reference

### Instructions

#### `createFraction(input, connection?, payer?)`
Creates a new fraction configuration.

**Parameters:**
- `input: CreatorFractionInputArgs`
  - `participants: Participant[]` - Array of participants (max 5)
  - `authority: PublicKey` - Configuration owner
  - `name?: string` - Optional name (auto-generated if not provided)
  - `botWallet?: PublicKey` - Bot authorized for distributions
- `connection?: Connection` - Solana connection for versioned transaction
- `payer?: PublicKey` - Transaction fee payer

**Returns:** `Transaction | VersionedTransaction`

**Example:**
```typescript
const participants = [
  { wallet: user1.publicKey, shareBps: 6000 },
  { wallet: user2.publicKey, shareBps: 4000 }
];

const tx = await createFraction({
  participants,
  authority: authority.publicKey,
  name: 'revenue-split-v1',
  botWallet: bot.publicKey
});
```

#### `updateFraction(config, input, connection?, payer?)`
Updates an existing fraction configuration.

**Parameters:**
- `config: PublicKey` - The fraction configuration account
- `input: UpdateFractionInputArgs`
  - `participants: Participant[]` - Updated participants array
  - `botWallet?: PublicKey` - Updated bot wallet
- `connection?: Connection` - Solana connection
- `payer?: PublicKey` - Transaction fee payer

**Returns:** `Transaction | VersionedTransaction`

**Example:**
```typescript
const updatedParticipants = [
  { wallet: user1.publicKey, shareBps: 5000 },
  { wallet: user2.publicKey, shareBps: 5000 }
];

const tx = await updateFraction(configPda, {
  participants: updatedParticipants,
  botWallet: newBot.publicKey
});
```

#### `claimAndDistribute(config, mint, connection?, payer?)`
Claims tokens from treasury and distributes to participants.

**Parameters:**
- `config: PublicKey` - The fraction configuration account
- `mint: PublicKey` - Token mint to distribute
- `connection?: Connection` - Solana connection
- `payer?: PublicKey` - Transaction fee payer

**Returns:** `Transaction | VersionedTransaction`

**Example:**
```typescript
const tx = await claimAndDistribute(
  configPda,
  usdcMint,
  connection,
  bot.publicKey
);
```

### State Queries

#### `getFractionsByParticipant(participant)`
Retrieves all fractions where the specified wallet is a participant.

**Parameters:**
- `participant: PublicKey` - Participant's wallet address

**Returns:** `Promise<FractionConfig[]>`

#### `getFractionsByConfig(config)`
Retrieves a specific fraction configuration.

**Parameters:**
- `config: PublicKey` - Configuration account address

**Returns:** `Promise<FractionConfig>`

### Instruction Builders

For advanced usage, you can build instructions without creating transactions:

#### `createFractionIx(input)`
**Returns:** `Promise<TransactionInstruction>`

#### `updateFractionIx(config, input)`
**Returns:** `Promise<TransactionInstruction>`

#### `claimAndDistributeIx(config, mint)`
**Returns:** `Promise<TransactionInstruction>`

## Types

```typescript
type Participant = {
  wallet: PublicKey;
  shareBps: number; // 0-10000 basis points
}

type FractionConfig = {
  authority: PublicKey;
  name: string;
  participants: Participant[];
  botWallet: PublicKey;
  incentiveBps: number;
  bump: number;
}

type CreatorFractionInputArgs = {
  participants: Participant[];
  authority: PublicKey;
  name?: string;
  botWallet?: PublicKey;
}

type UpdateFractionInputArgs = {
  participants: Participant[];
  botWallet?: PublicKey;
}
```

## Error Handling

The SDK includes comprehensive error handling for common scenarios:

- **InvalidShareDistribution (6000)**: Shares don't sum to 10,000 BPS
- **InsufficientBalance (6001)**: Not enough tokens for distribution
- **UnauthorizedWithdrawal (6002)**: Invalid authority for operation
- **NameTooLong (6003)**: Fraction name exceeds limit
- **NoFundsToDistribute (6004)**: Treasury is empty
- **DuplicateParticipantWallet (6007)**: Same wallet appears multiple times
- **BotWalletConflict (6008)**: Bot wallet matches a participant wallet

## Program Details

- **Program ID**: `2TZRnTed4ABnL41fLhcPn77d8AdqntYiEoKcvRtPeAK8`
- **Network**: Solana (Devnet/Mainnet)
- **Max Participants**: 5 per fraction
- **Share Precision**: Basis points (1 BPS = 0.01%)

## Advanced Usage

### Custom Transaction Building

```typescript
import { createFractionIx } from './sdk';
import { Transaction } from '@solana/web3.js';

// Build custom transaction with multiple instructions
const ix = await createFractionIx({
  participants: myParticipants,
  authority: authority.publicKey
});

const tx = new Transaction()
  .add(someOtherInstruction)
  .add(ix)
  .add(anotherInstruction);
```

### Treasury Management

The treasury uses Associated Token Accounts (ATA) derived from:
- Owner: Fraction configuration PDA
- Mint: Token being distributed

```typescript
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const treasuryAta = getAssociatedTokenAddressSync(
  tokenMint,
  fractionConfigPda,
  true // allowOwnerOffCurve
);
```

### PDA Derivation

```typescript
import { PublicKey } from '@solana/web3.js';

const [fractionConfigPda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("fraction_config"),
    authority.toBuffer(),
    Buffer.from(fractionName)
  ],
  programId
);
```

## Examples

### Revenue Sharing for a Creator

```typescript
// Setup 70% creator, 20% manager, 10% platform
const revenueShare = await createFraction({
  participants: [
    { wallet: creator.publicKey, shareBps: 7000 },
    { wallet: manager.publicKey, shareBps: 2000 },
    { wallet: platform.publicKey, shareBps: 1000 }
  ],
  authority: creator.publicKey,
  name: 'creator-revenue-v1',
  botWallet: distributionBot.publicKey
});
```

### Team Salary Distribution

```typescript
// Equal distribution among team members
const teamSplit = await createFraction({
  participants: [
    { wallet: dev1.publicKey, shareBps: 2500 },
    { wallet: dev2.publicKey, shareBps: 2500 },
    { wallet: designer.publicKey, shareBps: 2500 },
    { wallet: manager.publicKey, shareBps: 2500 }
  ],
  authority: company.publicKey,
  name: 'team-salary-q4-2024'
});
```

### Charitable Donations with Burn
//NEED TO BE IMPLEMENTED ?
```typescript
// 90% to charity, 10% burned
const charitySplit = await createFraction({
  participants: [
    { wallet: charityWallet.publicKey, shareBps: 9000 },
    { wallet: SystemProgram.programId, shareBps: 1000 } // Burn 10%
  ],
  authority: donor.publicKey,
  name: 'charity-donation-2024'
});
```

## Support

For issues, feature requests, or questions:
- Create an issue in the repository
- Check the test files for additional usage examples
- Review the program IDL for detailed account structures

## License

ISC License
