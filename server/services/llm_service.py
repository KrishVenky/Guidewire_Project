"""
Groq LLM service — Hinglish communication layer only.
The LLM never makes financial decisions.
Falls back to templated messages if no API key is set.
"""
from config import get_settings

settings = get_settings()

EVENT_TYPE_HINDI = {
    "HEAVY_RAIN": "baarish",
    "EXTREME_HEAT": "garmi",
    "HIGH_AQI": "pradushan",
    "NDMA_ALERT": "sarkaari alert",
    "ORDER_DROP": "orders mein kami",
    "BANDH": "bandh",
}

CLAIM_TEMPLATES = {
    "AUTO_APPROVED": (
        "Aaj {zone} mein {event_hindi} ki wajah se orders band the. "
        "Tera claim approved hai. ₹{amount} tera UPI {upi} mein jald aayega. "
        "Koi sawaal? App mein help check karo."
    ),
    "MANUAL_REVIEW": (
        "Tera claim review mein hai — 24 ghante mein update aayega. "
        "Koi cheez confirm karni ho toh app mein appeal kar sakta hai."
    ),
    "PAID": (
        "₹{amount} tera UPI {upi} mein aa gaya. "
        "Hermetical hamesha tera saath hai. 💪"
    ),
}


def _template_explanation(
    status: str,
    zone_name: str,
    event_type: str,
    payout_amount: float,
    upi_id: str,
) -> str:
    event_hindi = EVENT_TYPE_HINDI.get(event_type, "disruption")
    template = CLAIM_TEMPLATES.get(status, CLAIM_TEMPLATES["AUTO_APPROVED"])
    return template.format(
        zone=zone_name,
        event_hindi=event_hindi,
        amount=int(payout_amount),
        upi=upi_id,
    )


async def generate_claim_explanation(
    status: str,
    zone_name: str,
    event_type: str,
    payout_amount: float,
    upi_id: str,
) -> tuple[str, bool]:
    """Returns (explanation_text, used_fallback)"""
    if not settings.groq_api_key:
        return _template_explanation(status, zone_name, event_type, payout_amount, upi_id), True

    try:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)

        event_hindi = EVENT_TYPE_HINDI.get(event_type, "disruption")
        prompt = (
            f"Ek delivery worker ko {zone_name} mein {event_hindi} ki wajah se "
            f"kaam band karna pada. Unka insurance claim {status} hai aur "
            f"₹{int(payout_amount)} unke UPI mein aayega. "
            f"Unhe simple Hinglish mein samjhao — 80 words se kam. "
            f"Friendly raho, technical terms mat use karo."
        )

        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": (
                    "Tum Hermetical ke assistant ho. Delivery workers ko "
                    "simple Hinglish mein insurance decisions explain karo. "
                    "Financial decisions mat karo — sirf samjhao."
                )},
                {"role": "user", "content": prompt},
            ],
            max_tokens=150,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip(), False

    except Exception:
        return _template_explanation(status, zone_name, event_type, payout_amount, upi_id), True


async def onboarding_chat(
    message: str,
    worker_context: dict,
    conversation_history: list,
) -> tuple[str, bool]:
    """Returns (response_text, used_fallback)"""
    fallback = (
        "Hermetical aapko baarish, garmi, aur bandh jaise disruptions mein "
        "income protect karta hai. Weekly ₹35–70 premium mein UPI payout automatic aata hai. "
        "Koi aur sawaal?"
    )

    if not settings.groq_api_key:
        return fallback, True

    try:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)

        messages = [
            {"role": "system", "content": (
                "Tum Hermetical ke onboarding assistant ho delivery workers ke liye. "
                "Sirf Hermetical insurance ke baare mein jawab do — Hinglish mein, "
                "80 words se kam. Kisi aur topic pe redirect karo politely. "
                f"Worker context: zone={worker_context.get('zone', 'Bengaluru')}, "
                f"platform={worker_context.get('platform', 'Zomato')}."
            )}
        ]
        for h in conversation_history[-4:]:  # last 4 turns
            messages.append(h)
        messages.append({"role": "user", "content": message})

        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            max_tokens=120,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip(), False

    except Exception:
        return fallback, True
