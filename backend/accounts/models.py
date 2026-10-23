from django.db import models


class SignupChallenge(models.Model):
    token_digest = models.CharField(max_length=64, primary_key=True)
    email = models.EmailField()
    name = models.CharField(max_length=120)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True)


class AuthenticationWindow(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    attempts = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(db_index=True)
