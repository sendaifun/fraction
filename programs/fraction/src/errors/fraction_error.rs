use anchor_lang::prelude::*;

#[error_code]
pub enum FractionError {
    #[msg("Invalid share distribution - must sum to 10,000")]
    InvalidShareDistribution,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("No funds to distribute")]
    NoFundsToDistribute,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Duplicate participant wallet detected")]
    DuplicateParticipantWallet,
    #[msg("Bot wallet cannot be the same as any participant wallet")]
    BotWalletConflict,
    #[msg("Invalid authority provided")]
    InvalidAuthority,
    #[msg("Invalid bot wallet")]
    InvalidBot,
    #[msg("System program cannot be a participant wallet")]
    SystemProgramParticipant,
    #[msg("Invalid account owner")]
    InvalidAccount,
}
