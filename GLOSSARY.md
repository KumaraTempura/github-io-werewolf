# Werewolf Judge Notebook

A single-device, judge-operated notebook for recording Werewolf (狼人殺) games. It deals roles digitally when no physical cards exist and records seat roles and marks without enforcing the rules.

## Language

**Judge** (法官):
The single human who operates the app and is the only person allowed to see every role.
_Avoid_: Host, moderator, admin

**Seat** (座位):
A numbered player position from 1 to N. The notebook identifies players by seat number.
_Avoid_: Player ID, slot

**Board** (板子):
A named role composition for a game, either a rulebook preset or a custom set.
_Avoid_: Setup, configuration, deck

**Deal** (發牌):
Assigning roles to seats, either digitally by the app or physically with cards and entered by the judge.
_Avoid_: Distribute, assign

**Digital deal** (數位發牌):
The app shuffles roles across seats, the judge reviews, and each player views their seat privately.
_Avoid_: Online deal, remote deal

**Physical deal** (實體發牌):
Roles are dealt with physical cards; the judge enters each seat's role manually.
_Avoid_: Manual mode

**Draft**:
The editable pre-game state: board, role assignments, and reveal progress.
_Avoid_: Lobby, pre-game

**Start**:
The judge action that commits the draft and begins the game. Seat roles remain editable after Start.
_Avoid_: Begin, launch

**Camp** (陣營):
One of 狼人陣營, 好人陣營/神職, 好人陣營/平民, or 特殊陣營. Camps group roles; they do not determine good/bad reveals.
_Avoid_: Team, side, alignment

**Role catalog** (角色目錄):
The list of role names and camps used to assign seat roles. The notebook does not model role abilities.
_Avoid_: Role list, roles

**Notebook** (筆記):
The judge's record of the active game: each seat's role, out status, copied target, used flags, and table states. It does not validate or enforce game rules.
_Avoid_: Engine, simulator

**Out** (出局):
A judge-set flag marking a player as removed from the game. It carries no reason and has no separate revive action.
_Avoid_: Dead, eliminated

**Copied target** (模仿對象):
The seat a player copied, marked by the judge and shown on that player's seat. There is no separate copied-role field.
_Avoid_: Copied role, mimic target

**Used flag** (已用標記):
A judge-set checkbox on a seat recording that an ability or potion has been used: 已用, 解藥已用, or 毒藥已用. Flags are independent per seat: several seats may share the same used flag. Each persists until reset and has no automatic effect.
_Avoid_: Spent, consumed

**Table state** (場上狀態):
A judge-set condition on a seat: 警長, 禁言, 魅惑, 綁定, 攝夢, or 保護. Each table state is held by at most one seat; checking it on another seat clears it from the previous seat. Different table states may coexist on different seats or the same seat, and a table state has no automatic effect.
_Avoid_: Status, effect, buff

**Reveal**:
The judge-held display of a seat's role or a judge-chosen good/bad result, hidden again after the player has seen it. Reveals are not recorded.
_Avoid_: Hand-over, pass-and-play

**Good/bad** (好人／狼人):
The judge-chosen 好人 or 狼人 result shown in a reveal. The notebook does not derive it from the seat's role or camp.
_Avoid_: Camp result, alignment

**Reset**:
The judge action that wipes the active game and returns to the default setup page.
_Avoid_: Clear, new game
