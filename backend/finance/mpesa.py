import os
import base64
import requests
from datetime import datetime


class MpesaClient:
    """Lightweight MPesa Daraja helper for STK Push.

    Env vars required:
    - MPESA_CONSUMER_KEY
    - MPESA_CONSUMER_SECRET
    - MPESA_SHORT_CODE (till/paybill number)
    - MPESA_PASSKEY (Lipa Na Mpesa Online passkey)
    - MPESA_ENV (sandbox|production), default sandbox
    - MPESA_CALLBACK_URL (public HTTPS callback)
    """

    def __init__(self, *, consumer_key: str | None = None, consumer_secret: str | None = None,
                 short_code: str | None = None, passkey: str | None = None,
                 callback_url: str | None = None, environment: str | None = None):
        # Allow explicit overrides (per-school), otherwise fall back to env vars
        self.consumer_key = consumer_key or os.getenv('MPESA_CONSUMER_KEY')
        self.consumer_secret = consumer_secret or os.getenv('MPESA_CONSUMER_SECRET')
        self.short_code = short_code or os.getenv('MPESA_SHORT_CODE')
        self.passkey = passkey or os.getenv('MPESA_PASSKEY')
        self.callback = callback_url or os.getenv('MPESA_CALLBACK_URL', 'https://example.com/mpesa/callback')
        env = (environment or os.getenv('MPESA_ENV', 'sandbox')).lower()
        self.base = 'https://sandbox.safaricom.co.ke' if env != 'production' else 'https://api.safaricom.co.ke'

    def get_token(self):
        url = f"{self.base}/oauth/v1/generate?grant_type=client_credentials"
        resp = requests.get(url, auth=(self.consumer_key, self.consumer_secret), timeout=15)
        resp.raise_for_status()
        return resp.json()['access_token']

    def _timestamp(self):
        return datetime.now().strftime('%Y%m%d%H%M%S')

    def _password(self, timestamp):
        raw = f"{self.short_code}{self.passkey}{timestamp}".encode('utf-8')
        return base64.b64encode(raw).decode('utf-8')

    def stk_push(self, phone: str, amount: float, account_ref: str = 'EDU-TRACK', tx_desc: str = 'Fee Payment'):
        ts = self._timestamp()
        password = self._password(ts)
        token = self.get_token()
        headers = { 'Authorization': f'Bearer {token}', 'Content-Type': 'application/json' }
        payload = {
            "BusinessShortCode": int(self.short_code),
            "Password": password,
            "Timestamp": ts,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(round(float(amount))),
            "PartyA": phone,
            "PartyB": int(self.short_code),
            "PhoneNumber": phone,
            "CallBackURL": self.callback,
            "AccountReference": account_ref[:12] or 'EDU-TRACK',
            "TransactionDesc": tx_desc[:12] or 'Fees',
        }
        url = f"{self.base}/mpesa/stkpush/v1/processrequest"
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        resp.raise_for_status()
        return resp.json()
