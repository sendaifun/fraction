import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fraction } from "./idl";
import IDL from "./idl.json"
import { PublicKey, Connection } from "@solana/web3.js";

export const programId = new PublicKey("FracVQuBhSeBvbw1qNrJKkDmcdPcFYWdneoKbJa3HMrj")

export const getProgram = (connection: Connection) : Program<Fraction> => {
    return new anchor.Program<Fraction>(IDL as Fraction, {
        connection
    })
}