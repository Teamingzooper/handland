# Handland — rules as built in the prototype

Everything here is what the game actually enforces. Items marked **(filled in)** were blank in the design
overview and were decided while building; they are the first things to change if they feel wrong.
The numbers live at the top of `src/engine.js` (`RULES` and `CARDS`).

## Goal
Be the first to collect the chosen number of **Monopoly tokens**: 1 (quick), 2 (normal) or 3 (long).
Tokens are score only. They give no extra slots or perks.

## Setup
- 2 to 6 players. Each gets 5 resource cards (5 slots) and a hand of 3 cards, 0 Heat, 0 Cover.
- Resource deck: 14 each of Oil, Livestock, Farmland, Weapons, Workers. **(filled in)**
- One shared deck of Action and Boost cards (70 cards). **(filled in)**
- A random player goes first. **(filled in)**

## Your turn **(filled in)**
1. **Start.** If you have held 5 of a kind since the end of your last turn, score it (see Monopolies).
   Refill any empty resource slots from the deck. Draw 1 hand card.
2. **Main**, in any order:
   - Offer **one** trade.
   - Play any number of hand cards.
3. **End.** Discard down to your slot limit and hand limit (3).

There is no free way to swap resources. You change what you hold by trading, by paying for cards
(the slot refills next turn), and by winning call-outs.

## Trading
1. On your turn, pick a player, put one resource face down, **say** what it is (you may lie) and say what you want back.
2. They either decline, or put one of their resources face down and say what it is (they may lie too).
   Before agreeing they may instead **call scam** on your card.
3. If they agreed, you may **call scam** on their card, or accept and swap. If they say they are giving something
   **other than what you asked for**, you may also **call the trade off**: both cards go back and nobody is penalised.

A card put into a trade leaves its place in your row **empty**. If the trade falls through it goes back to that same place.

Calling a scam flips the accused card:
- **It was a lie:** the caller keeps both cards.
- **It was honest:** the accused keeps both cards, and the caller takes the call-out penalty.

### Open offers

Instead of naming one player, you may offer your card **to the table**. You still put it face down, say what it is and what you want.

- The offer goes round **clockwise, starting with the player on your left**. Each player in turn may trade, call it a scam, or pass.
- The **first player who answers gets the trade**; it then finishes exactly like a normal trade. A pass hands the offer to the next player.
- If everyone passes, the card comes back to you. Either way it was your one trade for the turn.
- Espionage used on an open offer shows the card only to the player who used it.

It goes by seat order, not by who is quickest, so it plays the same at a real table and online.

## Paying for cards (cost bluffing)
Most cards cost specific resources. You pay face down and claim it is the right thing. A cost of two cards is paid by one of each, in either order; if it is called, **both** cards are turned over and both must be right. Every other player
may pass or call.
- **Caught lying:** the card is wasted, and the caller takes the payment cards. **(filled in)**
- **Called but honest:** the card works, the caller takes the call-out penalty.
- **Nobody calls:** the card works and the payment is discarded unseen.

Calls go **clockwise from the payer's left, one player at a time**: each says pass or call, and the first to call makes the call.
Online each player gets 15 seconds; no answer counts as a pass. **(filled in)**

## Heat and Cover
- **Right call-out:** remove 1 Heat. If you have no Heat, gain 1 Cover (max 3 **(filled in)**).
- **Wrong call-out:** spend 1 Cover. If you have no Cover, gain 1 Heat (max 5 **(filled in)**).
- **Already at 5 Heat and no Cover:** a wrong call **destroys your leftmost resource card** instead.
- Each Heat turns one of your resource cards face up for everyone, starting from the left. **(filled in)**
- **You may never rearrange your resource row.** New cards always join at the right end.

### Seen cards (a game setting)
Because rows are never rearranged, a card you have seen can be followed for as long as it lies face down. On screen the
game can do that remembering for you. The host picks one of three: **Marked** (every card you have seen keeps a small
symbol: ones you looked at, ones flipped in a call, ones that passed through your hands), **My looks only** (only cards
you looked at with Espionage, Audit or a right Whistleblower), or **Not marked** (remember it yourself, as at a real table).

## Monopolies
- If you **end your turn** with 5 of one resource, a secret hold starts. Nobody is told. **(filled in: this is when the "full round" begins)**
- If you never drop below 5 before your next turn starts, you reveal your cards, gain 1 Monopoly token,
  discard those 5 cards and draw 5 new ones.
- Dropping below 5 at any moment (a trade, a Forced Trade, a Lawsuit, a Whistleblower) breaks the hold. Only you are told.
- A **Whistleblower** is right whenever the accused has five of a kind **at that moment**, whether or not their hold has
  formally begun (for example, a fifth card picked up since their last turn ended).
- An **Injunction** on you delays scoring by one turn; it does not break the hold.


### Monopoly powers

When you score a monopoly you may use that resource's power **once, right then**, before anything else on your turn.
It is free (nothing to call, and Alibi does not apply) and optional. The winning token has no power: the game is over.

| Monopoly on | Power | What it does |
|---|---|---|
| Oil | **Fracking** | Draw 2 extra Action or Boost cards. |
| Livestock | **Stampede** | Every other player discards the rightmost card of their row and draws a new one. |
| Farmland | **Harvest** | Look at the top 3 resource cards. Put one in your row and the other two back on top in any order. |
| Weapons | **Shakedown** | Take one resource from a player of your choice, unseen. |
| Workers | **Boycott** | Pick a player. They cannot play Action cards on their next turn (Boosts, Whistleblower and Alibi are still allowed). |

At a table: leave a marker in front of a boycotted player until their next turn ends.

## Cards

| Card | Type | Cost | Copies | Effect |
|---|---|---|---|---|
| Write-Off | Action | Free | 12 | Discard up to 3 of your resources, starting from the right end of your row, and draw that many new ones. |
| Forced Trade | Action | Weapons | 8 | Steal one of another player's resources. They get nothing back. |
| Whistleblower | Action | Free | 6 | Play at any time, even on someone else's turn. Accuse a player of having five of a kind right now. Right: you see their cards and take two of your choice. Wrong: the same penalty as a wrong call (lose 1 Cover, or gain 1 Heat). |
| Espionage | Action | Free | 5 | Look at one face-down resource. Also usable mid-trade to peek at the card put down for you. Rows are never rearranged, so a card you have seen stays where it is. |
| Strike | Action | Workers | 5 | Remove one of another player's Boosts, including a Duplicator tucked under a card. |
| Audit | Action | Workers | 4 | Look at up to three of one player's face-down resources (ones you have not seen first). Only you see them. |
| Injunction | Action | Oil | 4 | Pick a player. A monopoly they hold cannot score at the start of their next turn. They keep the cards and can score a round later. The table is not told whether anything was stopped. |
| Insider Tip | Action | Free | 4 | Draw 2 Action/Boost cards, keep one, discard the other. |
| Bribe | Action | Workers | 4 | Remove 1 of your Heat, or gain 1 Cover if you have none. |
| Lawsuit | Action | Free | 3 | Play with any call-out. If you are right, also take one random resource from the liar. Lost if you are wrong. |
| Alibi | Action | Free | 3 | Not played on your turn. When someone calls your trade card or payment, or blows the whistle on you, play it to cancel the call: nothing is turned over and nobody takes a penalty. A cancelled trade call ends that trade; a cancelled payment call counts as that player letting it through. |
| Warehouse | Boost | Farmland | 4 | +1 resource slot (+2 if Expanded). |
| Duplicator | Boost | Livestock | 4 | Tuck it under one of your resources: that card counts as 2 (3 if Expanded). If another player takes or destroys that card, you move the Duplicator under another of your resources. If you give the card up yourself (pay with it, trade it, discard it, score it), the Duplicator goes with it. A Strike destroys it. |
| Expansion | Boost | Oil | 2 | Attach to another of your Boosts: +1 to its effect. One per Boost. With no Boost that can take it, draw 2 cards instead. |
| Front Company | Boost | Weapons | 2 | Hides 1 card your Heat would reveal (2 if Expanded). |

All costs and copy counts are **(filled in)**.

## What bot-vs-bot testing shows
With these numbers, a 4-player first-to-2 game lasts about 9–10 rounds and first-to-1 about 4.
Around 60% of call-outs are correct, so calling is a real gamble either way.
Run `npm run sim` to re-measure after changing a number.
