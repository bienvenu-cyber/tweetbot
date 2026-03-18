import logging
from typing import Iterable

logger = logging.getLogger("instagram_bot")


def normalize_username(username: str) -> str:
    return username.strip().lstrip("@").lower()


def normalize_usernames(usernames: Iterable[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for username in usernames:
        clean = normalize_username(username)
        if clean and clean not in seen:
            normalized.append(clean)
            seen.add(clean)

    return normalized


def is_rate_limited(error: Exception | str) -> bool:
    lowered = str(error).lower()
    return "too many 429 error responses" in lowered or " 429 " in lowered or lowered.startswith("429")


def summarize_instagram_error(error: Exception | str, context: str | None = None) -> str:
    raw = str(error).strip()
    lowered = raw.lower()

    if is_rate_limited(raw):
        return "Instagram limite temporairement les requêtes pour cette session. Attends quelques minutes puis réessaie."

    if "feedback_required" in lowered or "spam" in lowered:
        return (
            "Instagram a temporairement restreint cette action DM pour cette session. "
            "Attends un moment, réouvre Instagram sur mobile, puis réimporte les cookies si besoin."
        )

    if "defcon" in lowered:
        return (
            "Instagram a placé la messagerie de cette session en mode de protection temporaire. "
            "Laisse reposer le compte puis réimporte des cookies frais depuis l'app ou le navigateur habituel."
        )

    if "direct_v2/inbox" in lowered:
        return (
            "Instagram refuse actuellement l'accès à la boîte de réception DM depuis cette session. "
            "La session n'est pas forcément expirée, mais les DMs sont temporairement indisponibles."
        )

    if "threads/broadcast/text" in lowered:
        return (
            "Instagram refuse l'envoi de DM depuis cette session. Réimporte les cookies du compte expéditeur "
            "puis vérifie dans l'app Instagram que l'envoi de message fonctionne."
        )

    if "challenge_required" in lowered or "checkpoint_required" in lowered:
        return "Instagram demande une vérification de sécurité pour ce compte. Valide-la dans l'app puis réimporte les cookies."

    if "two-factor" in lowered or "2fa" in lowered:
        return "Instagram bloque cette action à cause des protections du compte. Utilise une session fraîche après validation dans l'app."

    if "not logged in" in lowered:
        return "Aucune session Instagram active n'est disponible pour ce compte."

    if "user not found" in lowered:
        return "Compte Instagram introuvable."

    if context == "followers" and raw:
        return f"Impossible de charger les abonnés : {raw}"

    return raw or "Erreur Instagram inconnue."
