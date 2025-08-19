use anchor_lang::prelude::*;
use crate::states::participant::Participant;

#[account]
pub struct SplitterConfig {
    pub authority: Pubkey,
    pub name: String,
    pub participants: [Participant; 5],
    pub treasury_mint: Pubkey,//32
    pub bot_wallet: Pubkey,//32
    pub incentive_bps: u8,//1
    pub total_collected: u64,//8
    pub bump: u8,//1
}

impl SplitterConfig {
    pub const MAX_NAME_LENGTH: usize = 50;
    pub const LEN: usize = 8 + 32 + 4 + Self::MAX_NAME_LENGTH + (5 * Participant::LEN) + 32 + 32 + 1 + 8 + 1;

    /// Find participant index by wallet address
    pub fn find_participant_index(&self, wallet: &Pubkey) -> Option<usize> {
        self.participants.iter().position(|p| p.wallet == *wallet)
    }

    /// Get participant by wallet address
    pub fn get_participant(&self, wallet: &Pubkey) -> Option<&Participant> {
        self.participants.iter().find(|p| p.wallet == *wallet)
    }
}
