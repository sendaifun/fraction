use anchor_lang::prelude::*;

#[account]
pub struct ParticipantBalance {
    pub fraction: Pubkey,
    pub participant: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

impl ParticipantBalance {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1; // discriminator + fraction + participant + amount + bump
}
