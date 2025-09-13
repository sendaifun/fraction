use crate::states::participant::Participant;
use anchor_lang::prelude::*;

#[derive(InitSpace)]
#[account(discriminator = 1)]
pub struct FractionConfig {
    pub authority: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub participants: [Participant; 5],
    pub bot_wallet: Pubkey,
    pub incentive_bps: u8,
    pub bump: u8,
}
