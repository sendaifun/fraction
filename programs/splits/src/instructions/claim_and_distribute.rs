use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked},
};
use crate::states::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct ClaimAndDistribute<'info> {
    #[account(
        mut,
        seeds = [b"splitter_config", splitter_config.authority.as_ref()],
        bump,
    )]
    pub splitter_config: Box<Account<'info, SplitterConfig>>,

    #[account(
        mut,
        associated_token::mint = treasury_mint,
        associated_token::authority = splitter_config,
        associated_token::token_program = token_program,
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(
        constraint = treasury_mint.key() == splitter_config.treasury_mint
    )]
    pub treasury_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = bot_token_account.mint == treasury_mint.key()
    )]
    pub bot_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[0].wallet.as_ref()],
        bump,
        constraint = participant_balance_0.splitter == splitter_config.key()
    )]
    pub participant_balance_0: Box<Account<'info, ParticipantBalance>>,

    #[account(
        mut,
        seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[1].wallet.as_ref()],
        bump,
        constraint = participant_balance_1.splitter == splitter_config.key()
    )]
    pub participant_balance_1: Box<Account<'info, ParticipantBalance>>,

    #[account(
        mut,
        seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[2].wallet.as_ref()],
        bump,
        constraint = participant_balance_2.splitter == splitter_config.key()
    )]
    pub participant_balance_2: Box<Account<'info, ParticipantBalance>>,

    #[account(
        mut,
        seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[3].wallet.as_ref()],
        bump,
        constraint = participant_balance_3.splitter == splitter_config.key()
    )]
    pub participant_balance_3: Box<Account<'info, ParticipantBalance>>,

    #[account(
        mut,
        seeds = [b"balance", splitter_config.key().as_ref(), splitter_config.participants[4].wallet.as_ref()],
        bump,
        constraint = participant_balance_4.splitter == splitter_config.key()
    )]
    pub participant_balance_4: Box<Account<'info, ParticipantBalance>>,

    #[account(
        mut,
        seeds = [b"bot_balance", splitter_config.key().as_ref()],
        bump,
        constraint = bot_balance.splitter == splitter_config.key()
    )]
    pub bot_balance: Box<Account<'info, ParticipantBalance>>,

    #[account(
        constraint = bot_wallet.key() == splitter_config.bot_wallet
    )]
    pub bot_wallet: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    
}

impl<'info> ClaimAndDistribute<'info> {
    pub fn claim_and_distribute(&mut self) -> Result<()> {
        let total_amount = self.splitter_config.total_collected;
        require!(total_amount > 0, SplitsError::NoFundsToDistribute);

        // Calculate bot's share (2% = 200 BPS)
        let bot_amount = total_amount
            .checked_mul(self.splitter_config.incentive_bps as u64)
            .ok_or(SplitsError::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(SplitsError::ArithmeticOverflow)?;

        // Calculate remaining amount for participants
        let participant_amount = total_amount.checked_sub(bot_amount)
            .ok_or(SplitsError::ArithmeticOverflow)?;

        // Transfer bot's share
        if bot_amount > 0 {
            // Derive the correct bump for the splitter_config PDA
            let (_pda, bump) = Pubkey::find_program_address(
                &[b"splitter_config", self.splitter_config.authority.as_ref()],
                &crate::ID,
            );
            
            let signer_seeds = &[
                b"splitter_config",
                self.splitter_config.authority.as_ref(),
                &[bump],
            ];
            let signer = &[&signer_seeds[..]];

            let transfer_ctx = CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.treasury.to_account_info(),
                    mint: self.treasury_mint.to_account_info(),
                    to: self.bot_token_account.to_account_info(),
                    authority: self.splitter_config.to_account_info(),
                },
                signer,
            );

            transfer_checked(transfer_ctx, bot_amount, self.treasury_mint.decimals)?;

            // Update bot balance
            self.bot_balance.amount = self.bot_balance.amount.checked_add(bot_amount)
                .ok_or(SplitsError::ArithmeticOverflow)?;
        }

        // Distribute remaining amount to participants based on their shares
        let mut participant_balances = [
            &mut self.participant_balance_0,
            &mut self.participant_balance_1,
            &mut self.participant_balance_2,
            &mut self.participant_balance_3,
            &mut self.participant_balance_4,
        ];

        for (i, participant_balance) in participant_balances.iter_mut().enumerate() {
            let share_bps = self.splitter_config.participants[i].share_bps as u64;
            if share_bps > 0 {
                let participant_share = participant_amount
                    .checked_mul(share_bps)
                    .ok_or(SplitsError::ArithmeticOverflow)?
                    .checked_div(10000)
                    .ok_or(SplitsError::ArithmeticOverflow)?;

                if participant_share > 0 {
                    // Update participant balance record (tokens stay in treasury until withdrawal)
                    participant_balance.amount = participant_balance.amount.checked_add(participant_share)
                        .ok_or(SplitsError::ArithmeticOverflow)?;
                }
            }
        }

        // Reset total collected
        self.splitter_config.total_collected = 0;
        Ok(())
    }
}
