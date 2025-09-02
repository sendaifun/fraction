use crate::{errors::*, states::*};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(name: String)]
pub struct ClaimAndDistribute<'info> {
    pub bot: Signer<'info>,

    /// CHECK: The authority used to create the PDA. Checked via constraints.
    pub authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"splitter_config", authority.key().as_ref(), name.as_ref()],
        bump,
        constraint = splitter_config.authority == authority.key() @ SplitsError::InvalidAuthority,
        constraint = splitter_config.bot_wallet == bot.key() @ SplitsError::InvalidBot,
        constraint = splitter_config.name == name @ SplitsError::NameMismatch
    )]
    pub splitter_config: Box<Account<'info, SplitterConfig>>,

    #[account(mut, associated_token::mint = treasury_mint, associated_token::authority = splitter_config, associated_token::token_program = token_program)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,
    pub treasury_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, constraint = bot_token_account.mint == treasury_mint.key())]
    pub bot_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[0].wallet.as_ref()], bump = participant_balance_0.bump)]
    pub participant_balance_0: Box<Account<'info, ParticipantBalance>>,
    #[account(mut, seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[1].wallet.as_ref()], bump = participant_balance_1.bump)]
    pub participant_balance_1: Box<Account<'info, ParticipantBalance>>,
    #[account(mut, seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[2].wallet.as_ref()], bump = participant_balance_2.bump)]
    pub participant_balance_2: Box<Account<'info, ParticipantBalance>>,
    #[account(mut, seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[3].wallet.as_ref()], bump = participant_balance_3.bump)]
    pub participant_balance_3: Box<Account<'info, ParticipantBalance>>,
    #[account(mut, seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[4].wallet.as_ref()], bump = participant_balance_4.bump)]
    pub participant_balance_4: Box<Account<'info, ParticipantBalance>>,

    #[account(mut, seeds = [b"bot_balance", splitter_config.key().as_ref(), bot.key().as_ref()], bump = bot_balance.bump)]
    pub bot_balance: Box<Account<'info, ParticipantBalance>>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> ClaimAndDistribute<'info> {
    pub fn claim_and_distribute(&mut self) -> Result<()> {
        let treasury_balance = self.treasury.amount;
        require!(treasury_balance > 0, SplitsError::NoFundsToDistribute);

        let bot_amount = treasury_balance
            .checked_mul(self.splitter_config.incentive_bps as u64)
            .and_then(|x| x.checked_div(10_000))
            .ok_or(SplitsError::ArithmeticOverflow)?;

        let participant_total = treasury_balance
            .checked_sub(bot_amount)
            .ok_or(SplitsError::ArithmeticOverflow)?;

        let signer_seeds = &[
            b"splitter_config",
            self.splitter_config.authority.as_ref(),
            self.splitter_config.name.as_ref(),
            &[self.splitter_config.bump],
        ];
        let signer = &[&signer_seeds[..]];

        if bot_amount > 0 {
            transfer_checked(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    TransferChecked {
                        from: self.treasury.to_account_info(),
                        mint: self.treasury_mint.to_account_info(),
                        to: self.bot_token_account.to_account_info(),
                        authority: self.splitter_config.to_account_info(),
                    },
                    signer,
                ),
                bot_amount,
                self.treasury_mint.decimals,
            )?;
            self.bot_balance.amount = self
                .bot_balance
                .amount
                .checked_add(bot_amount)
                .ok_or(SplitsError::ArithmeticOverflow)?;
        }

        let participant_balances = [
            &mut self.participant_balance_0,
            &mut self.participant_balance_1,
            &mut self.participant_balance_2,
            &mut self.participant_balance_3,
            &mut self.participant_balance_4,
        ];

        for (i, participant_balance) in participant_balances.into_iter().enumerate() {
            let share_bps = self.splitter_config.participants[i].share_bps as u64;
            if share_bps > 0 {
                let participant_share = participant_total
                    .checked_mul(share_bps)
                    .and_then(|x| x.checked_div(10_000))
                    .ok_or(SplitsError::ArithmeticOverflow)?;
                participant_balance.amount = participant_balance
                    .amount
                    .checked_add(participant_share)
                    .ok_or(SplitsError::ArithmeticOverflow)?;
            }
        }
        Ok(())
    }
}
