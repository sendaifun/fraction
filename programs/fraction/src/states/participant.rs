use anchor_lang::prelude::*;

#[derive(InitSpace, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Participant {
    pub wallet: Pubkey,
    pub share_bps: u16,
}
