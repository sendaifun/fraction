use anchor_lang::prelude::*;
use crate::states::participant::Participant;


#[account]
pub struct SplitterConfig {
    pub authority: Pubkey,
    pub name: String,
    pub participants: [Participant; 5],
    pub bot_wallet: Pubkey, //32
    pub incentive_bps: u8, //1
    pub total_collected: u64, //8
    pub bump: u8,//1
}

impl SplitterConfig {
    pub const MAX_NAME_LENGTH: usize = 50;
    pub const LEN: usize = 8 + 32 + 4 + Self::MAX_NAME_LENGTH + (5 * Participant::LEN) + 32 + 1 + 8 + 1;
}
