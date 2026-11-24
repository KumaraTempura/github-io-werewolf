# Werewolf Judge Notebook

A single-device, judge-operated notebook for recording Werewolf (狼人殺) games. It deals roles digitally when no physical cards exist and records what happened without enforcing the rules.

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
The editable pre-game state: board, role assignments, and reveal progress. Autosaved, but not yet part of the event log.
_Avoid_: Lobby, pre-game

**Start**:
The judge action that commits the draft as one event with the final assignments and begins the game.
_Avoid_: Begin, launch

**Cycle**:
One night and the following daytime, displayed as 第 N 天 and used as the event log's tab unit.
_Avoid_: Day, round, day-night cycle

**Night**:
The first phase of a cycle (夜晚).
_Avoid_: Evening, night phase

**Daytime**:
The second phase of a cycle (白天), following its night.
_Avoid_: Day

**Phase**:
One of the two parts of a cycle: night or daytime.
_Avoid_: Stage, step, period

**Reveal**:
The judge-held display of a seat's role or peek result to that player, hidden again after they have seen it.
_Avoid_: Hand-over, pass-and-play

**Role catalog** (角色目錄):
The data-driven definition of every role: name, camp, ability, tracked state, peek kind, and night order.
_Avoid_: Role list, roles

**Notebook** (筆記):
The append-only record of judge-entered events. It does not validate or enforce game rules.
_Avoid_: Engine, simulator

**Event** (事件):
One judge-recorded action or change: deal, phase advance, ability use, peek, elimination, table-state change, or note. Undo removes the last event.
_Avoid_: Action, log entry, step

**Table state** (場上狀態):
A judge-set condition on a seat: 警長 badge, 禁言, 魅惑, 綁定, 攝夢, or 中毒/負傷.
_Avoid_: Status, effect, buff

**Out** (出局):
A player removed from the game, with a recorded reason.
_Avoid_: Dead, eliminated

**Peek** (查驗):
A private, role-aware reveal to the player using an inspection ability: exact role, camp, teammate number, or last-exile camp.
_Avoid_: Inspect, check, view role

**Used** (已使用):
A manual judge-set flag that a role's ability has been used. It persists across cycles; advancing a phase does not reset it. The app does not infer it.
_Avoid_: Spent, consumed
