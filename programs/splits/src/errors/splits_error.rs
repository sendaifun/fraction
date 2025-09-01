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
    #[msg("Participant wallet mismatch - individual wallet parameters must match participants array")]
    ParticipantWalletMismatch,
    #[msg("Duplicate participant wallet detected")]
    DuplicateParticipantWallet,
    #[msg("Bot wallet cannot be the same as any participant wallet")]
    BotWalletConflict,
    #[msg("Only the authorized bot can call this instruction")]
    UnauthorizedBot,
    #[msg("Invalid authority provided")]
    InvalidAuthority,
    #[msg("Provided name does not match splitter config name")]
    NameMismatch,
    #[msg("Invalid bot wallet")]
    InvalidBot,
}
