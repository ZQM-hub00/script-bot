# Script Bot

Un bot Discord pour gérer et distribuer des scripts via des commandes slash. Permet aux propriétaires de serveur de créer, modifier et gérer des scripts avec whitelists.

## Installation

1. Installe Node.js (version 16+ recommandée).
2. Clone ou télécharge ce repo.
3. Exécute `npm install` pour installer les dépendances.
4. Copie `.env.example` vers `.env` et remplace les valeurs par tes vraies IDs/tokens Discord.
5. Lance avec `npm start`.

## Configuration

- Crée un bot sur https://discord.com/developers/applications.
- Active les intents `Guilds` et `Guild Members` dans le portail développeur.
- Invite le bot sur ton serveur avec les permissions nécessaires (gérer les rôles, envoyer des messages, etc.).
- Remplis les variables d'environnement :
  - `TOKEN` : Token du bot
  - `CLIENT_ID` : ID de l'application
  - `GUILD_ID` : ID du serveur
  - `ROLE_TEMP` : ID d'un rôle temporaire
  - `LOG_CHANNEL` : ID du canal de logs
  - `SCRIPT_CHANNEL` : ID du canal pour envoyer les scripts
  - `DENY_CHANNEL` : ID du canal pour les refus

## Commandes

- `/activate` : Affiche le menu des scripts (utilisateurs whitelistés seulement).
- `/edit` : Modifier un script (propriétaire seulement).
- `/whitelist` : Voir la whitelist d'un script.
- `/editwhitelist` : Ajouter/retirer des utilisateurs de la whitelist (propriétaire seulement).
- `/whitelist_auto <utilisateur>` : Rechercher un utilisateur dans toutes les whitelists (propriétaire seulement).
- `/info` : Afficher les statistiques du bot (nombre de scripts, etc.).

Le bot génère automatiquement 15 scripts vides au premier lancement.