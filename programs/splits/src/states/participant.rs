use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct Participant {
    pub wallet: Pubkey,
    pub share_bps: u16,
}

impl Participant {
    pub const LEN: usize = 32 + 2; // Pubkey + u16
}