use anchor_lang::prelude::*;

#[error_code]
pub enum SplitsError {
    #[msg("Invalid share distribution - must sum to 10,000")]
    InvalidShareDistribution,
    #[msg("Insufficient treasury balance")]
    InsufficientTreasuryBalance,
    #[msg("Insufficient balance for withdrawal")]
    InsufficientBalance,
    #[msg("Unauthorized withdrawal attempt")]
    UnauthorizedWithdrawal,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("No funds to distribute")]
    NoFundsToDistribute,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid participant wallet")]
    InvalidParticipantWallet,
}
