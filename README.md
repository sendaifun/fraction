# Fraction

A secure, automated token distribution system built on Solana that splits funds among multiple participants with a fixed bot incentive.

## 🌟 Overview

Fraction is a Solana program that enables automated token distribution among multiple participants. Users can deposit tokens into a shared treasury, and a bot triggers distribution where participants receive their allocated shares and the bot earns a fixed 2% incentive for managing the distribution.

## ✨ Key Features

- **🔐 Secure Distribution**: Built with Anchor framework for maximum security
- **⚡ Automated Payouts**: Bot-triggered distribution system
- **📊 Flexible Shares**: Customizable participant share percentages
- **🎯 Fixed Bot Incentive**: Consistent 2% reward for distribution management
- **🏦 Treasury Management**: Secure fund custody using Program Derived Addresses (PDAs)
- **🔄 Multiple Deposits**: Cumulative deposit tracking before distribution
- **💸 Individual Withdrawals**: Participants can withdraw their allocated funds independently

## 🏗️ Architecture

### Core Components

1. **Splitter Config**: Main configuration storing participant details and bot wallet
2. **Treasury**: Associated Token Account holding deposited funds
3. **Participant Balances**: Individual PDAs tracking each participant's allocated amount
4. **Bot Balance**: PDA tracking bot's earned incentives

### Distribution Flow

```
Deposits → Treasury → Distribution (Bot: 2%, Participants: 98%) → Individual Withdrawals
```

## 🚀 Instructions

### 1. Initialize Splitter
Creates a new splitter with participant configuration.

```rust
initialize_splitter(
    name: String,
    participants: Vec<Participant>,
    treasury_mint: Pubkey,
    bot_wallet: Pubkey,
    // Individual participant wallets for PDA derivation
    participant_wallet_0: Pubkey,
    participant_wallet_1: Pubkey,
    participant_wallet_2: Pubkey,
    participant_wallet_3: Pubkey,
    participant_wallet_4: Pubkey,
)
```

### 2. Update Splitter
Modify participant shares and bot wallet (authority only).

```rust
update_splitter(
    participants: Vec<Participant>,
    bot_wallet: Pubkey,
)
```

### 3. Deposit Tokens
Add tokens to the treasury for later distribution.

```rust
deposit_tokens(amount: u64)
```

### 4. Claim and Distribute
Trigger distribution of all collected funds (bot only).

```rust
claim_and_distribute()
```

### 5. Withdraw Share
Individual participants withdraw their allocated tokens.

```rust
withdraw_share()
```

## 📊 Account Structure

### SplitterConfig
```rust
pub struct SplitterConfig {
    pub name: String,                    // Splitter identifier
    pub authority: Pubkey,              // Admin wallet
    pub participants: Vec<Participant>,  // Participant details
    pub bot_wallet: Pubkey,             // Bot wallet address
    pub treasury_mint: Pubkey,          // Token mint address
    pub total_collected: u64,           // Accumulated deposits
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

### ParticipantBalance
```rust
pub struct ParticipantBalance {
    pub splitter: Pubkey,     // Associated splitter
    pub participant: Pubkey,  // Participant wallet
    pub amount: u64,          // Allocated amount
    pub bump: u8,             // PDA bump seed
}
```

## 🔧 Development Setup

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

## 🧪 Testing

The project includes a comprehensive test suite with 15 test cases covering:

- ✅ **Core Functionality** (5 tests): Initialize, update, deposit, distribute, withdraw
- ✅ **Security & Authorization** (4 tests): Access control and validation
- ✅ **Edge Cases & Robustness** (4 tests): Multiple deposits, minimal amounts, error handling
- ✅ **Business Logic & Lifecycle** (2 tests): Bot incentive verification and end-to-end flow

**Test Results**: 15/15 passing (100% success rate)

Run tests with:
```bash
anchor test
```

For detailed test explanations, see [test_summary.md](./test_summary.md).

## 📋 Usage Examples

### TypeScript/JavaScript Client

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fraction } from "./target/types/Fraction";

// Initialize program
const program = anchor.workspace.Fraction as Program<Fraction>;

// Create a new splitter
const participants = [
  { wallet: participant1.publicKey, shareBps: 4000 }, // 40%
  { wallet: participant2.publicKey, shareBps: 3000 }, // 30%
  { wallet: participant3.publicKey, shareBps: 2000 }, // 20%
  { wallet: participant4.publicKey, shareBps: 1000 }, // 10%
];

await program.methods
  .initializeSplitter(
    "my-splitter",
    participants,
    mintAddress,
    botWallet.publicKey,
    participant1.publicKey,
    participant2.publicKey,
    participant3.publicKey,
    participant4.publicKey,
  )
  .accounts({
    authority: authority.publicKey,
    splitterConfig: splitterConfigPda,
    treasury: treasuryPda,
    // ... other accounts
  })
  .signers([authority])
  .rpc();

// Deposit tokens
await program.methods
  .depositTokens(new anchor.BN(1000000))
  .accounts({
    splitterConfig: splitterConfigPda,
    treasury: treasuryPda,
    userTokenAccount: userTokenAccount,
    user: user.publicKey,
  })
  .signers([user])
  .rpc();

// Trigger distribution (bot only)
await program.methods
  .claimAndDistribute()
  .accounts({
    splitterConfig: splitterConfigPda,
    treasury: treasuryPda,
    botTokenAccount: botTokenAccount,
    botWallet: botWallet.publicKey,
    // ... participant balance accounts
  })
  .signers([botWallet])
  .rpc();
```

## 🔒 Security Features

- **Access Control**: Authority-only updates, bot-only distributions
- **PDA Security**: Proper seed validation for all accounts
- **Token Safety**: Uses `transfer_checked` for all token operations
- **Mathematical Precision**: Basis points system for accurate percentage calculations
- **Account Validation**: Comprehensive constraint checking via Anchor

## 🎯 Use Cases

- **Revenue Sharing**: Distribute project earnings among team members
- **Staking Rewards**: Automated distribution of staking rewards
- **DAO Treasuries**: Manage and distribute DAO funds
- **Creator Royalties**: Split NFT or content royalties
- **Investment Pools**: Distribute returns to investors
- **Gaming Rewards**: Distribute tournament prizes or in-game earnings

## 🛠️ Configuration

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
- **Max Participants**: 5 (can be modified in code)
- **Basis Points**: 10,000 = 100%

## 📊 Economics

### Fee Structure
- **Bot Incentive**: 2% of total distributed amount
- **Participant Share**: 98% of total distributed amount (split according to configured percentages)
- **No Additional Fees**: Only standard Solana transaction fees apply

### Example Distribution
For 1,000,000 tokens distributed:
- **Bot receives**: 20,000 tokens (2%)
- **Participants split**: 980,000 tokens (98% according to their share percentages)

## 🚀 Deployment

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

## 📚 Documentation

- [Test Summary](./test_summary.md) - Detailed explanation of all test cases
- [Anchor Documentation](https://anchor-lang.com/) - Framework documentation
- [Solana Documentation](https://docs.solana.com/) - Platform documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is provided "as is" without warranty. Users should conduct thorough testing and auditing before using in production. The developers are not responsible for any loss of funds.

## 🙋‍♂️ Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Join our Discord community
- Email: support@Fraction.com

---

**Built with ❤️ for the Solana ecosystem**
