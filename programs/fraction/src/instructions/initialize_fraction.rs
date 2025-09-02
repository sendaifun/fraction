use crate::{errors::*, states::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(name: String, participants: [Participant; 5], bot_wallet: Pubkey, participant_wallet_0: Pubkey, participant_wallet_1: Pubkey, participant_wallet_2: Pubkey, participant_wallet_3: Pubkey, participant_wallet_4: Pubkey)]
pub struct InitializeFraction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(init, payer = authority, space = FractionConfig::LEN, seeds = [b"fraction_config", authority.key().as_ref(), name.as_ref()], bump)]
    pub fraction_config: Box<Account<'info, FractionConfig>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", fraction_config.key().as_ref(), participant_wallet_0.as_ref()], bump)]
    pub participant_balance_0: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", fraction_config.key().as_ref(), participant_wallet_1.as_ref()], bump)]
    pub participant_balance_1: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", fraction_config.key().as_ref(), participant_wallet_2.as_ref()], bump)]
    pub participant_balance_2: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", fraction_config.key().as_ref(), participant_wallet_3.as_ref()], bump)]
    pub participant_balance_3: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", fraction_config.key().as_ref(), participant_wallet_4.as_ref()], bump)]
    pub participant_balance_4: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"bot_balance", fraction_config.key().as_ref(), bot_wallet.as_ref()], bump)]
    pub bot_balance: Box<Account<'info, ParticipantBalance>>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeFraction<'info> {
    pub fn initialize_fraction(
        &mut self,
        name: String,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
        _p0: Pubkey,
        _p1: Pubkey,
        _p2: Pubkey,
        _p3: Pubkey,
        _p4: Pubkey,
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

        require!(
            _p0 == participants[0].wallet,
            FractionError::ParticipantWalletMismatch
        );
        require!(
            _p1 == participants[1].wallet,
            FractionError::ParticipantWalletMismatch
        );
        require!(
            _p2 == participants[2].wallet,
            FractionError::ParticipantWalletMismatch
        );
        require!(
            _p3 == participants[3].wallet,
            FractionError::ParticipantWalletMismatch
        );
        require!(
            _p4 == participants[4].wallet,
            FractionError::ParticipantWalletMismatch
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

        for (i, bal) in wallets.iter().enumerate() {
            let data = ParticipantBalance {
                fraction: self.fraction_config.key(),
                participant: *bal,
                amount: 0,
                bump: match i {
                    0 => bumps.participant_balance_0,
                    1 => bumps.participant_balance_1,
                    2 => bumps.participant_balance_2,
                    3 => bumps.participant_balance_3,
                    4 => bumps.participant_balance_4,
                    _ => unreachable!(),
                },
            };
            match i {
                0 => self.participant_balance_0.set_inner(data),
                1 => self.participant_balance_1.set_inner(data),
                2 => self.participant_balance_2.set_inner(data),
                3 => self.participant_balance_3.set_inner(data),
                4 => self.participant_balance_4.set_inner(data),
                _ => unreachable!(),
            };
        }

        self.bot_balance.set_inner(ParticipantBalance {
            fraction: self.fraction_config.key(),
            participant: bot_wallet,
            amount: 0,
            bump: bumps.bot_balance,
        });
        Ok(())
    }
}
