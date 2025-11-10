use crate::{errors::*, states::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitializeFraction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    // Config PDA (program-owned) - stores your FractionConfig data
    #[account(
        init,
        payer = authority,
        space = 8 + FractionConfig::INIT_SPACE,
        seeds = [b"fraction_config", authority.key().as_ref(), name.as_ref()],
        bump
    )]
    pub fraction_config: Account<'info, FractionConfig>,

    // Vault PDA (system-owned) - holds SOL and can have ATAs
    #[account(
        mut,
        seeds = [b"fraction_vault", authority.key().as_ref(), name.as_ref()],
        bump
    )]
    pub fraction_vault: SystemAccount<'info>,

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
            participants.iter().map(|p| p.share_bps as u32).sum::<u32>() == 10_000,
            FractionError::InvalidShareDistribution
        );

        for p in participants.iter() {
            if p.wallet == anchor_lang::system_program::ID && p.share_bps > 0 {
                return Err(FractionError::SystemProgramParticipant.into());
            }
        }

        let wallets = [
            participants[0].wallet,
            participants[1].wallet,
            participants[2].wallet,
            participants[3].wallet,
            participants[4].wallet,
        ];
        for i in 0..5 {
            for j in (i + 1)..5 {
                if wallets[i] == anchor_lang::system_program::ID
                    || wallets[j] == anchor_lang::system_program::ID
                {
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
            incentive_bps: 5u8,
            vault_bump: bumps.fraction_vault,
            config_bump: bumps.fraction_config,
        });

        Ok(())
    }
}
