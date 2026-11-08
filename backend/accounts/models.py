from django.db import models


class SignupCode(models.Model):
    """A single-use code that lets one new account set up one company."""

    id = models.UUIDField(primary_key=True)
    code_digest = models.CharField(max_length=64, unique=True)
    label = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True)
    # Verifying an account claims the code. The claim carries the company details entered
    # at signup until that account finishes company setup.
    claimed_by = models.ForeignKey(
        "cleanforce_identity.PlatformUser", null=True, on_delete=models.PROTECT
    )
    claimed_at = models.DateTimeField(null=True)
    company_name = models.CharField(max_length=200, blank=True)
    logo = models.ForeignKey("companies.CompanyLogo", null=True, on_delete=models.SET_NULL)
    company = models.OneToOneField("companies.Company", null=True, on_delete=models.PROTECT)


class SignupChallenge(models.Model):
    token_digest = models.CharField(max_length=64, primary_key=True)
    email = models.EmailField()
    name = models.CharField(max_length=120)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True)
    signup_code = models.ForeignKey(SignupCode, null=True, on_delete=models.CASCADE)
    company_name = models.CharField(max_length=200, blank=True)
    logo = models.ForeignKey("companies.CompanyLogo", null=True, on_delete=models.SET_NULL)


class AuthenticationWindow(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    attempts = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(db_index=True)


class ExternalLogin(models.Model):
    """A Google or Microsoft account that signs in as this person."""

    provider = models.CharField(max_length=20)
    # The provider's stable account ID; email addresses can change hands, these do not.
    subject = models.CharField(max_length=255)
    user = models.ForeignKey("cleanforce_identity.PlatformUser", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["provider", "subject"], name="one_user_per_login")
        ]
