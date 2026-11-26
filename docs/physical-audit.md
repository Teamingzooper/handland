# Handland: can every rule be played with real cards?

Checked on 2026-11-26 against the rules the computer game enforces (`src/engine.js`, version 0.12.0).
The printable rules that come out of this are in `print/rules-sheet.html` (and `print/Handland-rules.pdf`).

## Verdict

The game works at a table. 20 of the 24 rules need no change. Four need a physical ruling because the
computer currently does something a table cannot, and three of those rulings differ from the computer
game in a way you should decide on (see "Decisions for you" at the end).

## Rule by rule

| # | Rule | What the computer does | At a table | Ruling used in the printed rules |
|---|---|---|---|---|
| 1 | Setup: 5 resources, 3 hand cards | Deals for you | Works | Deal 5 resources face down in a row, 3 hand cards |
| 2 | Your own resources are hidden from others | Shows only you your cards | Works | They lie face down in front of you; you may look at your own at any time |
| 3 | Start of turn: refill empty slots, draw 1 | Automatic | Works | Same |
| 4 | One trade per turn | Enforced | Works | Same |
| 5 | Trade: card face down, say what it is | Hides the card | Works | Same |
| 6 | Calling a scam on an offer puts one of your cards at stake | Asks for the stake card | Works | Same: put a card down before you call; the winner keeps both |
| 7 | Open offers go clockwise | Seat order | Works | Same (this rule was designed for the table) |
| 8 | **A traded card stays hidden even if it was seen earlier** | Forgets what you knew about that card for the trade | **Differs** | Rows are fixed, so a player who peeked a card can follow it into a trade. See decision A |
| 9 | Paying a cost face down | Hides the payment | Works | Same |
| 10 | **Who may call a payment** | All other players get 15 seconds at once; the first click wins | **Needs a ruling** | Go clockwise from the payer's left: each player says "pass" or "call". First to call makes the call. See decision B |
| 11 | Uncalled payment is discarded unseen | Automatic | Works | Put it face down on the discard pile; nobody may look |
| 12 | Right call: lose 1 Heat, else gain 1 Cover | Automatic | Works | Tokens |
| 13 | Wrong call: lose 1 Cover, else gain 1 Heat | Automatic | Works | Tokens. Nobody ever has both kinds |
| 14 | Heat turns your leftmost cards face up | Automatic | Works | Keep resources in a row. With N Heat, the N leftmost are face up. New cards join on the right |
| 15 | Front Company hides 1 Heat card | Automatic | Works | Turn one fewer card face up (two fewer if Expanded) |
| 16 | **Secret monopoly hold** | Remembers silently who is holding, and silently cancels a hold that drops below 5 | **Needs a ruling** | Every player has two marker cards, HOLDING and NOT HOLDING, and places one face down at the end of every turn. See decision C |
| 17 | Scoring a monopoly | Shows your cards, banks the fewest cards that add up to 5, redraws | Works | Flip your marker, show your resources, discard the 5, take a token, refill |
| 18 | Whistleblower, any time | Interrupts whatever is happening | Works | Play it and say a name; the game pauses. Flip that player's marker |
| 19 | Whistleblower right: see their cards, take two | Shows only the caller | Works | They show their resources to the caller only |
| 20 | Lawsuit takes a "random" card | Random pick | Works | The winner takes one face-down card without looking first |
| 21 | Espionage: look at one card | Marks it for you while it stays in that row | Works | You look, then it goes back in its place. Rows are never rearranged |
| 22 | Duplicator on a resource | Tracks which card | Works | Tuck the Duplicator under that resource card. If the card leaves you, discard the Duplicator |
| 23 | Hand limit 3, slot limit 5 (+Warehouses) | Enforced at end of turn | Works | Same |
| 24 | **Thinking-time clocks** (15 s, 30 s, 75 s) | Timers | Not needed | No timers. The table keeps the pace |

Things that exist only on screen and need no physical version: bots and difficulty, the end-of-game
"lies told" table, sounds, themes. Deck skins become printed deck variants.

## Decisions for you

These three are where the printed rules and the computer game now differ. Each is playable as written;
the question is whether to change the computer game to match, so all three platforms have one rulebook.

**A. Row order (decided by you, 2026-11-26).**
Players may **not** rearrange their resource cards, because Heat turns cards face up from the left. New cards join
at the right. So a card someone has peeked stays known for as long as it lies there, on screen and at the table.
The new **Write-Off** card (free, 8 copies) is the way to refresh a row: discard up to 3 from the right end and draw
that many. One difference remains: on screen, a card put into a trade is hidden from the other player even if they
peeked it earlier (you asked for that); at a table a sharp-eyed player can follow a card they have seen into a trade.

**B. Who gets to call a payment.**
On the computer the fastest click wins, which rewards a fast connection and cannot be done fairly at a
table. The printed rules go clockwise from the payer's left. **Done in 0.13.0:** the computer game now asks each player in seat order.

**C. The hold marker.**
On the computer a hold that drops below five is cancelled silently, so a Whistleblower on that player is
wrong. At a table the marker still says HOLDING. The printed rule: a Whistleblower is right only if the
marker says HOLDING **and** the player can show five of a kind; otherwise it is wrong. That matches the
computer game's outcome in every case, and it adds a small bluff: you may leave a HOLDING marker down
after your hold was broken, to bait a Whistleblower. It costs 12 extra cards (2 per player).

## Components for a printed copy

| Item | Count |
|---|---|
| Resource cards: Oil, Livestock, Farmland, Weapons, Workers | 14 each = 70 |
| Action and Boost cards | 70 (see the card table in the rules sheet) |
| Hold markers: HOLDING and NOT HOLDING | 1 of each per player = 12 |
| **Cards in total** | **152** (17 sheets of 9) |
| Heat tokens | 30 (5 per player) |
| Cover tokens | 18 (3 per player) |
| Monopoly tokens | 13 (enough for a 6-player game to 3) |

## Cards added in 0.17.0 (checked for table play)

- **Alibi** needs no extra component: the accused simply plays it when called. At a table nobody knows you hold one until you use it (on screen the game pauses for the holder, which gives the same information a moment earlier).
- **Injunction** needs a visible reminder: leave the card in front of the named player until their next turn starts.
- **Audit** and **Insider Tip** work as written. **Whistleblower** now costs one wrong-call penalty, not two.

## Monopoly powers, added in 0.18.0 (checked for table play)

Scoring a monopoly lets its owner use that resource's power once, straight away. All five work with real cards:

| Power | At a table | Needs |
|---|---|---|
| Fracking (Oil) | Draw 2 from the card deck | nothing |
| Stampede (Livestock) | Everyone else discards the card at the right end of their row and draws one | nothing; rows are never rearranged, so "rightmost" is unambiguous |
| Harvest (Farmland) | Look at the top 3 of the resource deck, keep one, put two back in the order you choose | nothing; only the scorer looks |
| Shakedown (Weapons) | Take one face-down card from a player without looking first | nothing (same as Lawsuit's blind pick) |
| Boycott (Workers) | The named player may not play Action cards on their next turn | a visible marker in front of them until that turn ends: 2 Boycott markers in the box |

On screen the scorer has 30 seconds to decide; at a table there is no timer. Components: add **2 Boycott markers** to the token list above.

## Rule changes in 0.19.0 (checked for table play)

- **Calling a trade off.** If the answer is not what was asked for, the offerer may say "no deal": both cards go back. Works as spoken.
- **Gaps.** A card put into a trade leaves its place in the row open, and returns to that place. At a table: slide the card forward out of the row instead of closing the row up.
- **Duplicator.** It lies under the card it doubles. If that card is taken or destroyed by someone else, its owner moves the Duplicator under another card straight away. A Strike discards it.
- **Five Heat.** A wrong call at 5 Heat (and no Cover) discards the caller's leftmost card.
- **Whistleblower.** Right if the accused can show five of a kind at that moment. The Hold markers are now only needed to prove a full round was held when scoring; a Whistleblower no longer depends on them.
- **Seen cards.** The on-screen setting (marked / my looks only / not marked) has no table equivalent: at a table, remembering is always up to the players.

## Not covered here

- Printable card sheets now exist: `print/Handland-cards.pdf` (`npm run cards`), 154 cards at playing-card size, nine
  to a sheet with cut marks, separate backs for the two decks, and a token sheet. Not yet test-printed on paper.
- Playtesting with people. The numbers were tuned with bot-vs-bot games only.
