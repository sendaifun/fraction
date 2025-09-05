/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/fraction.json`.
 */
export type Fraction = {
    "address": "2TZRnTed4ABnL41fLhcPn77d8AdqntYiEoKcvRtPeAK8",
    "metadata": {
      "name": "fraction",
      "version": "0.1.0",
      "spec": "0.1.0",
      "description": "Created with Anchor"
    },
    "instructions": [
      {
        "name": "claimAndDistribute",
        "discriminator": [
          3
        ],
        "accounts": [
          {
            "name": "bot",
            "signer": true
          },
          {
            "name": "authority"
          },
          {
            "name": "fractionConfig",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    102,
                    114,
                    97,
                    99,
                    116,
                    105,
                    111,
                    110,
                    95,
                    99,
                    111,
                    110,
                    102,
                    105,
                    103
                  ]
                },
                {
                  "kind": "account",
                  "path": "authority"
                },
                {
                  "kind": "arg",
                  "path": "name"
                }
              ]
            }
          },
          {
            "name": "treasury",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "account",
                  "path": "fractionConfig"
                },
                {
                  "kind": "account",
                  "path": "tokenProgram"
                },
                {
                  "kind": "account",
                  "path": "treasuryMint"
                }
              ],
              "program": {
                "kind": "const",
                "value": [
                  140,
                  151,
                  37,
                  143,
                  78,
                  36,
                  137,
                  241,
                  187,
                  61,
                  16,
                  41,
                  20,
                  142,
                  13,
                  131,
                  11,
                  90,
                  19,
                  153,
                  218,
                  255,
                  16,
                  132,
                  4,
                  142,
                  123,
                  216,
                  219,
                  233,
                  248,
                  89
                ]
              }
            }
          },
          {
            "name": "treasuryMint"
          },
          {
            "name": "botTokenAccount",
            "writable": true
          },
          {
            "name": "participantTokenAccount0",
            "writable": true
          },
          {
            "name": "participantTokenAccount1",
            "writable": true
          },
          {
            "name": "participantTokenAccount2",
            "writable": true
          },
          {
            "name": "participantTokenAccount3",
            "writable": true
          },
          {
            "name": "participantTokenAccount4",
            "writable": true
          },
          {
            "name": "tokenProgram"
          }
        ],
        "args": [
          {
            "name": "name",
            "type": "string"
          }
        ]
      },
      {
        "name": "initializeFraction",
        "discriminator": [
          1
        ],
        "accounts": [
          {
            "name": "authority",
            "writable": true,
            "signer": true
          },
          {
            "name": "fractionConfig",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    102,
                    114,
                    97,
                    99,
                    116,
                    105,
                    111,
                    110,
                    95,
                    99,
                    111,
                    110,
                    102,
                    105,
                    103
                  ]
                },
                {
                  "kind": "account",
                  "path": "authority"
                },
                {
                  "kind": "arg",
                  "path": "name"
                }
              ]
            }
          },
          {
            "name": "systemProgram",
            "address": "11111111111111111111111111111111"
          }
        ],
        "args": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "participants",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "participant"
                  }
                },
                5
              ]
            }
          },
          {
            "name": "botWallet",
            "type": "pubkey"
          }
        ]
      },
      {
        "name": "updateFraction",
        "discriminator": [
          2
        ],
        "accounts": [
          {
            "name": "authority",
            "signer": true
          },
          {
            "name": "fractionConfig",
            "writable": true,
            "pda": {
              "seeds": [
                {
                  "kind": "const",
                  "value": [
                    102,
                    114,
                    97,
                    99,
                    116,
                    105,
                    111,
                    110,
                    95,
                    99,
                    111,
                    110,
                    102,
                    105,
                    103
                  ]
                },
                {
                  "kind": "account",
                  "path": "authority"
                },
                {
                  "kind": "account",
                  "path": "fraction_config.name",
                  "account": "fractionConfig"
                }
              ]
            }
          }
        ],
        "args": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "participants",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "participant"
                  }
                },
                5
              ]
            }
          },
          {
            "name": "botWallet",
            "type": "pubkey"
          }
        ]
      }
    ],
    "accounts": [
      {
        "name": "fractionConfig",
        "discriminator": [
          1
        ]
      }
    ],
    "errors": [
      {
        "code": 6000,
        "name": "invalidShareDistribution",
        "msg": "Invalid share distribution - must sum to 10,000"
      },
      {
        "code": 6001,
        "name": "insufficientBalance",
        "msg": "Insufficient balance for withdrawal"
      },
      {
        "code": 6002,
        "name": "unauthorizedWithdrawal",
        "msg": "Unauthorized withdrawal attempt"
      },
      {
        "code": 6003,
        "name": "nameTooLong",
        "msg": "Name too long"
      },
      {
        "code": 6004,
        "name": "noFundsToDistribute",
        "msg": "No funds to distribute"
      },
      {
        "code": 6005,
        "name": "arithmeticOverflow",
        "msg": "Arithmetic overflow"
      },
      {
        "code": 6006,
        "name": "participantWalletMismatch",
        "msg": "Participant wallet mismatch - individual wallet parameters must match participants array"
      },
      {
        "code": 6007,
        "name": "duplicateParticipantWallet",
        "msg": "Duplicate participant wallet detected"
      },
      {
        "code": 6008,
        "name": "botWalletConflict",
        "msg": "Bot wallet cannot be the same as any participant wallet"
      },
      {
        "code": 6009,
        "name": "invalidAuthority",
        "msg": "Invalid authority provided"
      },
      {
        "code": 6010,
        "name": "nameMismatch",
        "msg": "Provided name does not match fraction config name"
      },
      {
        "code": 6011,
        "name": "invalidBot",
        "msg": "Invalid bot wallet"
      }
    ],
    "types": [
      {
        "name": "fractionConfig",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "authority",
              "type": "pubkey"
            },
            {
              "name": "name",
              "type": "string"
            },
            {
              "name": "participants",
              "type": {
                "array": [
                  {
                    "defined": {
                      "name": "participant"
                    }
                  },
                  5
                ]
              }
            },
            {
              "name": "botWallet",
              "type": "pubkey"
            },
            {
              "name": "incentiveBps",
              "type": "u8"
            },
            {
              "name": "bump",
              "type": "u8"
            }
          ]
        }
      },
      {
        "name": "participant",
        "type": {
          "kind": "struct",
          "fields": [
            {
              "name": "wallet",
              "type": "pubkey"
            },
            {
              "name": "shareBps",
              "type": "u16"
            }
          ]
        }
      }
    ]
  };
  