"""
Pool of real Android device profiles for Instagram fingerprint diversification.
Each account gets a unique, persistent device identity to avoid detection.
"""

import hashlib
import random
import logging
from typing import Optional

logger = logging.getLogger("instagram_bot")

# Real Android device profiles — each entry mimics a genuine phone
DEVICE_POOL = [
    {
        "app_version": "269.0.0.18.75",
        "android_version": 31,
        "android_release": "12",
        "dpi": "420dpi",
        "resolution": "1080x2400",
        "manufacturer": "samsung",
        "device": "o1s",
        "model": "SM-G991B",
        "cpu": "exynos2100",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 33,
        "android_release": "13",
        "dpi": "420dpi",
        "resolution": "1080x2340",
        "manufacturer": "samsung",
        "device": "dm1q",
        "model": "SM-S911B",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 33,
        "android_release": "13",
        "dpi": "440dpi",
        "resolution": "1080x2400",
        "manufacturer": "Google",
        "device": "oriole",
        "model": "Pixel 6",
        "cpu": "google_tensor",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 34,
        "android_release": "14",
        "dpi": "420dpi",
        "resolution": "1080x2400",
        "manufacturer": "Google",
        "device": "husky",
        "model": "Pixel 8 Pro",
        "cpu": "google_tensor_g3",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 31,
        "android_release": "12",
        "dpi": "440dpi",
        "resolution": "1080x2400",
        "manufacturer": "Xiaomi",
        "device": "venus",
        "model": "M2011K2G",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 33,
        "android_release": "13",
        "dpi": "440dpi",
        "resolution": "1080x2400",
        "manufacturer": "Xiaomi",
        "device": "cupid",
        "model": "2201123G",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 31,
        "android_release": "12",
        "dpi": "480dpi",
        "resolution": "1440x3200",
        "manufacturer": "samsung",
        "device": "p3s",
        "model": "SM-G998B",
        "cpu": "exynos2100",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 33,
        "android_release": "13",
        "dpi": "400dpi",
        "resolution": "1080x2340",
        "manufacturer": "OnePlus",
        "device": "OP5958L1",
        "model": "CPH2449",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 32,
        "android_release": "12L",
        "dpi": "420dpi",
        "resolution": "1080x2400",
        "manufacturer": "samsung",
        "device": "r0s",
        "model": "SM-G980F",
        "cpu": "exynos990",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 34,
        "android_release": "14",
        "dpi": "420dpi",
        "resolution": "1080x2340",
        "manufacturer": "samsung",
        "device": "dm3q",
        "model": "SM-S926B",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 33,
        "android_release": "13",
        "dpi": "440dpi",
        "resolution": "1080x2400",
        "manufacturer": "Google",
        "device": "cheetah",
        "model": "Pixel 7 Pro",
        "cpu": "google_tensor_g2",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 31,
        "android_release": "12",
        "dpi": "440dpi",
        "resolution": "1080x2340",
        "manufacturer": "Xiaomi",
        "device": "alioth",
        "model": "M2012K11AG",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 33,
        "android_release": "13",
        "dpi": "480dpi",
        "resolution": "1440x3088",
        "manufacturer": "samsung",
        "device": "b0q",
        "model": "SM-S908B",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 34,
        "android_release": "14",
        "dpi": "420dpi",
        "resolution": "1080x2340",
        "manufacturer": "OnePlus",
        "device": "aston",
        "model": "CPH2585",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 32,
        "android_release": "12L",
        "dpi": "440dpi",
        "resolution": "1080x2400",
        "manufacturer": "Xiaomi",
        "device": "vili",
        "model": "2107113SG",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 33,
        "android_release": "13",
        "dpi": "420dpi",
        "resolution": "1080x2400",
        "manufacturer": "Google",
        "device": "panther",
        "model": "Pixel 7",
        "cpu": "google_tensor_g2",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 31,
        "android_release": "12",
        "dpi": "420dpi",
        "resolution": "1080x2400",
        "manufacturer": "samsung",
        "device": "t2s",
        "model": "SM-G996B",
        "cpu": "exynos2100",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 34,
        "android_release": "14",
        "dpi": "480dpi",
        "resolution": "1440x3120",
        "manufacturer": "samsung",
        "device": "e3q",
        "model": "SM-S928B",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 33,
        "android_release": "13",
        "dpi": "440dpi",
        "resolution": "1080x2400",
        "manufacturer": "Xiaomi",
        "device": "marble",
        "model": "23049PCD8G",
        "cpu": "qcom",
        "version_code": "443233152",
    },
    {
        "app_version": "269.0.0.18.75",
        "android_version": 34,
        "android_release": "14",
        "dpi": "420dpi",
        "resolution": "1080x2400",
        "manufacturer": "Google",
        "device": "shiba",
        "model": "Pixel 8",
        "cpu": "google_tensor_g3",
        "version_code": "443233152",
    },
]


def pick_device_for_account(username: str) -> dict:
    """Deterministically pick a device from the pool based on the username hash.
    This ensures the same account always gets the same device model,
    even before any session is saved."""
    idx = int(hashlib.md5(username.lower().encode()).hexdigest(), 16) % len(DEVICE_POOL)
    device = DEVICE_POOL[idx]
    logger.info(
        f"[DEVICE] Assigned {device['manufacturer']} {device['model']} to @{username} "
        f"(pool index {idx}/{len(DEVICE_POOL)})"
    )
    return device


def get_device_label(settings: Optional[dict]) -> Optional[str]:
    """Extract a human-readable device label from saved settings."""
    if not settings:
        return None
    ds = settings.get("device_settings", {})
    if not ds:
        return None
    manufacturer = ds.get("manufacturer", "")
    model = ds.get("model", "")
    if manufacturer and model:
        return f"{manufacturer} {model}"
    return None
