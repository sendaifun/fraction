use crate::states::participant::Participant;
use anchor_lang::prelude::*;

#[account]
pub struct SplitterConfig {
    pub authority: Pubkey,
    pub name: String,
    pub participants: [Participant; 5],
    pub bot_wallet: Pubkey,
    pub incentive_bps: u8,
    pub bump: u8,
}

impl SplitterConfig {
    pub const MAX_NAME_LENGTH: usize = 50;
    pub const LEN: usize = 8 + 32 + 4 + Self::MAX_NAME_LENGTH + (5 * Participant::LEN) + 32 + 1 + 1;
}
