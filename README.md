# ARPG

[![build](https://img.shields.io/github/actions/workflow/status/advocaite/arpg/ci.yml?label=build)](https://github.com/advocaite/arpg/actions)
[![stars](https://img.shields.io/github/stars/advocaite/arpg?style=social)](https://github.com/advocaite/arpg/stargazers)
[![forks](https://img.shields.io/github/forks/advocaite/arpg?style=social)](https://github.com/advocaite/arpg/network/members)
[![watchers](https://img.shields.io/github/watchers/advocaite/arpg?style=social)](https://github.com/advocaite/arpg/watchers)
[![license](https://img.shields.io/github/license/advocaite/arpg)](https://github.com/advocaite/arpg/blob/master/LICENSE)

## Overview

Phaser 3 action RPG with a data‑driven architecture:
- Modular powers/effects and AI brains
- Inventory, equipment, item qualities, and affixes (primary/secondary/legendary)
- Centralized drop system with coins, hearts, items, and Magic Find
- JSON‑driven content for skills, passives, items, affixes, sets, and worlds

## Quick Start

```bash
npm install
npm run redev   # stop → build → start dev server
```

Dev server: `http://127.0.0.1:5177/`

## Screenshots

<p>
  <img src="src/screenshots/mainmenu.png" width="420" alt="Main Menu" />
  <img src="src/screenshots/skill%20select.png" width="420" alt="Skill Select" />
</p>
<p>
  <img src="src/screenshots/skill%20overview.png" width="420" alt="Skills Overview" />
  <img src="src/screenshots/items_inv.png" width="420" alt="Inventory & Items" />
</p>
<p>
  <img src="src/screenshots/combat.png" width="860" alt="Combat" />
</p>

## Key Systems

- Item qualities with colored tooltips and modular affixes
- Legendary affixes with support for proc‑based powers
- Equipment aggregation with dynamic stat updates on equip/unequip
- Unified kill→drop helper used by all powers (melee, AoE, lightning, thorns)
- Magic Find stat affecting drop and affix quality

## Build/Run Workflow

- Always stop running servers before building
- Use `npm run redev` to automate stop → build → dev


