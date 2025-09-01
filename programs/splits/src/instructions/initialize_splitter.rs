use crate::{errors::*, states::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(name: String, participants: [Participant; 5], bot_wallet: Pubkey, participant_wallet_0: Pubkey, participant_wallet_1: Pubkey, participant_wallet_2: Pubkey, participant_wallet_3: Pubkey, participant_wallet_4: Pubkey)]
pub struct InitializeSplitter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(init, payer = authority, space = SplitterConfig::LEN, seeds = [b"splitter_config", authority.key().as_ref(), name.as_ref()], bump)]
    pub splitter_config: Box<Account<'info, SplitterConfig>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_0.as_ref()], bump)]
    pub participant_balance_0: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_1.as_ref()], bump)]
    pub participant_balance_1: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_2.as_ref()], bump)]
    pub participant_balance_2: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_3.as_ref()], bump)]
    pub participant_balance_3: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_4.as_ref()], bump)]
    pub participant_balance_4: Box<Account<'info, ParticipantBalance>>,

    #[account(init, payer = authority, space = ParticipantBalance::LEN, seeds = [b"bot_balance", splitter_config.key().as_ref(), bot_wallet.as_ref()], bump)]
    pub bot_balance: Box<Account<'info, ParticipantBalance>>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeSplitter<'info> {
    pub fn initialize_splitter(
        &mut self,
        name: String,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
        _p0: Pubkey,
        _p1: Pubkey,
        _p2: Pubkey,
        _p3: Pubkey,
        _p4: Pubkey,
        bumps: &InitializeSplitterBumps,
    ) -> Result<()> {
        require!(
            name.len() <= SplitterConfig::MAX_NAME_LENGTH,
            SplitsError::NameTooLong
        );
        require!(
            participants.iter().map(|p| p.share_bps as u32).sum::<u32>() == 10_000,
            SplitsError::InvalidShareDistribution
        );

        require!(
            _p0 == participants[0].wallet,
            SplitsError::ParticipantWalletMismatch
        );
        require!(
            _p1 == participants[1].wallet,
            SplitsError::ParticipantWalletMismatch
        );
        require!(
            _p2 == participants[2].wallet,
            SplitsError::ParticipantWalletMismatch
        );
        require!(
            _p3 == participants[3].wallet,
            SplitsError::ParticipantWalletMismatch
        );
        require!(
            _p4 == participants[4].wallet,
            SplitsError::ParticipantWalletMismatch
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
                    SplitsError::DuplicateParticipantWallet
                );
            }
        }
        require!(
            !wallets.contains(&bot_wallet),
            SplitsError::BotWalletConflict
        );

        self.splitter_config.set_inner(SplitterConfig {
            authority: self.authority.key(),
            name,
            participants,
            bot_wallet,
            incentive_bps: 200u8,
            bump: bumps.splitter_config,
        });

        for (i, bal) in wallets.iter().enumerate() {
            let data = ParticipantBalance {
                splitter: self.splitter_config.key(),
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
            splitter: self.splitter_config.key(),
            participant: bot_wallet,
            amount: 0,
            bump: bumps.bot_balance,
        });
        Ok(())
    }
}
