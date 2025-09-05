import * as anchor from "@coral-xyz/anchor";
import { Fraction } from "./idl";
import IDL from "./idl.json"
import { PublicKey } from "@solana/web3.js";

export default new anchor.Program<Fraction>(IDL as Fraction)

export const programId = new PublicKey("2TZRnTed4ABnL41fLhcPn77d8AdqntYiEoKcvRtPeAK8")