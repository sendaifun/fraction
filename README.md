# Fraction

A secure, automated token distribution system built on Solana that distributes funds among multiple participants with a fixed bot incentive.

## Overview

Fraction is a Solana program that enables automated token distribution among multiple participants. Clients fund a shared treasury, and a designated bot triggers direct distribution where participants receive their allocated shares immediately in their token accounts, while the bot earns a fixed 2% incentive for managing the distribution.

## Key Features

- **Secure Distribution**: Built with Anchor framework for maximum security
- **Bot-Only Distribution**: Only designated bot wallet can trigger distributions
- **Direct Distribution**: Participants receive tokens directly in their ATAs during distribution
- **Flexible Shares**: Customizable participant share percentages (up to 5 participants)
- **Fixed Bot Incentive**: Consistent 2% reward for distribution management
- **Client-Managed Treasury**: Treasury creation and funding handled client-side
- **Immediate Distribution**: Both bot and participants receive tokens instantly upon distribution
- **No Withdrawal Step**: Eliminates need for separate withdrawal instructions
- **Multiple Rounds**: Treasury can be refunded for multiple distribution rounds

## Architecture

### Core Components

1. **Fraction Config**: Main configuration PDA storing participant details and bot wallet
2. **Treasury**: Associated Token Account (client-managed) holding funds for distribution
3. **Direct Distribution**: Bot transfers funds directly to participant ATAs during claim_and_distribute

### Distribution Flow

```
Client Creates Treasury → Client Funds Treasury → Bot Distributes Directly (Bot: 2%, Participants: 98% directly to ATAs) → Treasury Empty
```

## Instructions

## Instructions

### 1. Initialize Fraction
Creates a new fraction with participant configuration (authority only).

```rust
initialize_fraction(
    name: String,
    participants: [Participant; 5],
    bot_wallet: Pubkey,
)
```

### 2. Update Fraction
Modify participant shares and bot wallet (authority only).

```rust
update_fraction(
    name: String,
    participants: [Participant; 5],
    bot_wallet: Pubkey,
)
```

### 3. Treasury Management (Client-Side)
Create treasury and fund it with tokens for distribution.

```typescript
// Create treasury ATA (client-side) - MUST be owned by fraction config PDA
const treasury = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, fractionConfigPda, true
);

// Fund treasury (client-side)  
await transfer(connection, payer, userTokenAccount, treasury.address, authority, amount);
```

### 4. Claim and Distribute
Trigger direct distribution of treasury funds to all participants (bot only).

```rust
claim_and_distribute(name: String)
```
- Only the designated bot wallet can call this instruction
- Bot receives 2% immediately, participants receive 98% directly in their ATAs
- Treasury funds are completely distributed and treasury is emptied
- Treasury must be an associated token account owned by the fraction config PDA

### 5. No Withdrawal Step Required
Participants receive tokens directly during distribution - no additional steps needed.

- Tokens are transferred directly to participant ATAs during `claim_and_distribute`
- No separate withdrawal instruction required
- No balance tracking PDAs needed
- Simplified user experience with immediate token receipt

## Account Structure

### FractionConfig
```rust
pub struct FractionConfig {
    pub authority: Pubkey,               // Admin wallet
    pub name: String,                    // Fraction identifier
    pub participants: [Participant; 5], // Fixed array of 5 participants
    pub bot_wallet: Pubkey,             // Bot wallet address
    pub incentive_bps: u8,              // Fixed at 200 (2%)
    pub bump: u8,                       // PDA bump seed
}
```

### Participant
```rust
pub struct Participant {
    pub wallet: Pubkey,    // Participant's wallet
    pub share_bps: u16,    // Share in basis points (10000 = 100%)
}
```

## Development Setup

### Prerequisites
- Rust 1.70+
- Solana CLI 1.16+
- Anchor Framework 0.28+
- Node.js 18+
- Yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Fraction
```

2. **Install dependencies**
```bash
# Install Rust dependencies
cargo build

# Install Node.js dependencies
yarn install
```

3. **Build the program**
```bash
anchor build
```

4. **Run tests**
```bash
anchor test
```

## Testing

The project includes a comprehensive test suite with 8 test cases covering:

- **Core Functionality** (4 tests): Initialize, update, create treasury, direct distribution
- **Multiple Distribution Rounds** (1 test): Supports multiple funding and distribution cycles
- **Error Handling** (2 tests): Empty treasury and unauthorized access validation
- **Security & Authorization** (1 test): Invalid share distribution rejection

**Test Results**: 8/8 passing (100% success rate)

Run tests with:
```bash
anchor test
```

All tests validate the complete lifecycle: initialization → treasury management → bot-triggered direct distribution → immediate participant receipt.

## Complete Workflow

### Step-by-Step Process

1. **Setup Phase** (Authority)
   - Authority initializes fraction with 5 participants and their share percentages
   - All participant shares must total exactly 10,000 BPS (100%)
   - Bot wallet is designated for distribution control

2. **Treasury Phase** (Client-Side)
   - Client creates Associated Token Account (ATA) for treasury
   - Treasury is owned by the fraction config PDA for security
   - Client transfers tokens to treasury for distribution

3. **Distribution Phase** (Bot-Only)
   - Only the designated bot wallet can trigger distribution
   - Bot receives 2% of treasury funds immediately
   - Participants receive 98% directly in their token accounts
   - Treasury is completely emptied after distribution

4. **Ready for Next Round** (Optional)
   - Client can refund treasury for additional distribution rounds
   - Process repeats: fund treasury → bot distributes → participants receive tokens
   - No manual withdrawal steps required

### Key Benefits
- **Security**: Bot-only distribution prevents unauthorized access
- **Efficiency**: Single distribution transfers tokens to all participants simultaneously
- **Simplicity**: No separate withdrawal step required for participants
- **Immediate**: Participants receive tokens instantly during distribution
- **Transparency**: All transfers are atomic and visible on-chain

## Usage Examples

### TypeScript/JavaScript Client

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fraction } from "./target/types/fraction";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

// Initialize program
const program = anchor.workspace.Fraction as Program<Fraction>;

// Create a new fraction (5 participants required)
const participants = [
  { wallet: participant1.publicKey, shareBps: 3000 }, // 30%
  { wallet: participant2.publicKey, shareBps: 2500 }, // 25% 
  { wallet: participant3.publicKey, shareBps: 2000 }, // 20%
  { wallet: participant4.publicKey, shareBps: 1500 }, // 15%
  { wallet: participant5.publicKey, shareBps: 1000 }, // 10%
];

await program.methods
  .initializeFraction(
    "my-fraction",
    participants,
    botWallet.publicKey,
  )
  .accountsPartial({
    authority: authority.publicKey,
    fractionConfig: fractionConfigPda,
  })
  .signers([])
  .rpc();

// Create and fund treasury (client-side)
const treasury = await getOrCreateAssociatedTokenAccount(
  connection, payer, mintAddress, fractionConfigPda, true
);

await transfer(
  connection, payer, userTokenAccount, treasury.address, authority, 1000000
);

// Trigger direct distribution (bot only)
await program.methods
  .claimAndDistribute("my-fraction")
  .accountsPartial({
    authority: authority.publicKey,
    bot: botWallet.publicKey,
    fractionConfig: fractionConfigPda,
    treasury: treasury.address,
    treasuryMint: mintAddress,
    botTokenAccount: botTokenAccount,
    participantTokenAccount0: participant1TokenAccount,
    participantTokenAccount1: participant2TokenAccount,
    participantTokenAccount2: participant3TokenAccount,
    participantTokenAccount3: participant4TokenAccount,
    participantTokenAccount4: participant5TokenAccount,
  })
  .signers([botWallet])
  .rpc();

// No withdrawal step needed - participants already received tokens!
```

## Security Features

- **Access Control**: Authority-only updates, bot-only distributions
- **PDA Security**: Proper seed validation for all accounts
- **Token Safety**: Uses `transfer_checked` for all token operations
- **Mathematical Precision**: Basis points system for accurate percentage calculations
- **Account Validation**: Comprehensive constraint checking via Anchor
- **Associated Token Accounts**: Treasury must be ATA owned by fraction config PDA
- **Share Validation**: Participant shares must sum to exactly 10,000 BPS (100%)

## Use Cases

- **Revenue Sharing**: Distribute project earnings among team members
- **Staking Rewards**: Automated distribution of staking rewards
- **DAO Treasuries**: Manage and distribute DAO funds
- **Creator Royalties**: Split NFT or content royalties
- **Investment Pools**: Distribute returns to investors
- **Gaming Rewards**: Distribute tournament prizes or in-game earnings

## Configuration

### Environment Variables
```bash
# Anchor.toml
[programs.localnet]
Fraction = "YOUR_PROGRAM_ID"

[programs.devnet]
Fraction = "YOUR_PROGRAM_ID"

[programs.mainnet]
Fraction = "YOUR_PROGRAM_ID"
```

### Program Constants
- **Bot Incentive**: Fixed at 2% (200 BPS)
- **Participants**: Exactly 5 participants required
- **Basis Points**: 10,000 = 100%

## Economics

### Fee Structure
- **Bot Incentive**: 2% of total distributed amount
- **Participant Share**: 98% of total distributed amount (split according to configured percentages)
- **No Additional Fees**: Only standard Solana transaction fees apply

### Example Distribution
For 1,000,000 tokens distributed:
- **Bot receives**: 20,000 tokens (2%)
- **Participants split**: 980,000 tokens (98% according to their share percentages)

## Deployment

### Local Development
```bash
# Start local validator
solana-test-validator

# Deploy to local
anchor deploy
```

### Devnet Deployment
```bash
# Set to devnet
solana config set --url devnet

# Deploy
anchor deploy --provider.cluster devnet
```

### Mainnet Deployment
```bash
# Set to mainnet
solana config set --url mainnet-beta

# Deploy (ensure thorough testing first!)
anchor deploy --provider.cluster mainnet-beta
```

## Documentation

- [Anchor Documentation](https://anchor-lang.com/) - Framework documentation
- [Solana Documentation](https://docs.solana.com/) - Platform documentation
- [SPL Token Documentation](https://spl.solana.com/token) - Token program documentation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This software is provided "as is" without warranty. Users should conduct thorough testing and auditing before using in production. The developers are not responsible for any loss of funds.

## Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Join our Discord community
- Email: support@fraction.com

---

**Built with love for the Solana ecosystem**
