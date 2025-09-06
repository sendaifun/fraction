use crate::{errors::*, states::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(name: String, participants: [Participant; 5], bot_wallet: Pubkey)]
pub struct InitializeFraction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(init, payer = authority, space = 1 + FractionConfig::INIT_SPACE, seeds = [b"fraction_config", authority.key().as_ref(), name.as_ref()], bump)]
    pub fraction_config: Box<Account<'info, FractionConfig>>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeFraction<'info> {
    pub fn initialize_fraction(
        &mut self,
        name: String,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
        bumps: &InitializeFractionBumps,
    ) -> Result<()> {
        require!(
            name.len() <= FractionConfig::MAX_NAME_LENGTH,
            FractionError::NameTooLong
        );
        require!(
            participants.iter().map(|p| p.share_bps as u32).sum::<u32>() == 10_000,
            FractionError::InvalidShareDistribution
        );

        let wallets = [
            participants[0].wallet,
            participants[1].wallet,
            participants[2].wallet,
            participants[3].wallet,
            participants[4].wallet,
        ];
        for i in 0..5 {
            for j in (i + 1)..5 {
                if wallets[i] == System::id() || wallets[j] == System::id() {
                    continue;
                }
                require!(
                    wallets[i] != wallets[j],
                    FractionError::DuplicateParticipantWallet
                );
            }
        }
        require!(
            !wallets.contains(&bot_wallet),
            FractionError::BotWalletConflict
        );

        self.fraction_config.set_inner(FractionConfig {
            authority: self.authority.key(),
            name,
            participants,
            bot_wallet,
            incentive_bps: 200u8,
            bump: bumps.fraction_config,
        });

        Ok(())
    }
}
